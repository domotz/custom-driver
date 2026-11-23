/**
 * Refreshes the tables the "Sonicwall firewall - Product lifecycle" driver downloads from master, from SonicWall's
 * product lifecycle page (https://www.sonicwall.com/support/product-lifecycle-tables):
 *  - sonicwall-plc-tables-v2.json, read by the driver from 1.0.4: every row, unpublished dates as null.
 *  - sonicwall-plc-tables.json, read by older copies: the same without the Hardware rows missing a date those
 *    copies show. They count an unpublished date as 0 days remaining, which would fire end-of-life alerts.
 *
 *     node resources/sonicwall-plc-refresh.js              # fetch the page, rewrite both files
 *     node resources/sonicwall-plc-refresh.js page.html    # use a saved copy of the page
 *     node resources/sonicwall-plc-refresh.js --check      # print what would change, write nothing
 *
 * Only the Hardware and Firmware tables are refreshed, merged by (series, type, sortid): rows SonicWall lists are
 * updated, new ones added, rows it no longer lists kept. Software tables and the file's schema are left as they are.
 * Hardware rows are stored shortest model name first and before Firmware, which is what older copies of the
 * driver need (they take a family's first table and the first row whose model contains the device's number).
 * Anything unexpected in the page aborts the run before a file is touched.
 */
const fs = require("fs");
const path = require("path");

const PAGE_URL = "https://www.sonicwall.com/support/product-lifecycle-tables";
const TABLE_FILE = path.join(__dirname, "sonicwall-plc-tables-v2.json");
const LEGACY_FILE = path.join(__dirname, "sonicwall-plc-tables.json");
// The Hardware dates driver copies before 1.0.4 show, each with its remaining days.
const LEGACY_DATES = ["lod", "armb", "oneyldo", "lrmb", "eos"];

// The page's series names drop the "SonicWall " prefix the file uses. The page's SuperMassive Series lists the
// rows the file keeps under SuperMassive 9000 Series (SWSM-H-5..8); the file's own SuperMassive Series is older.
const SERIES_OVERRIDES = { "SuperMassive Series": "SonicWall SuperMassive 9000 Series" };
const REFRESHED_TYPES = ["Hardware", "Firmware"];
const KNOWN_TYPES = ["Hardware", "Firmware", "Software"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function date(row, field) {
    const value = row[field];
    if (value === "" || value === null || value === undefined) {
        return null;
    }
    if (!DATE.test(value)) {
        throw new Error(row.sorting_id + ": " + field + " is not a YYYY-MM-DD date: " + JSON.stringify(value));
    }
    return value;
}

// The file keeps firmware release dates as MM/DD/YYYY.
function usDate(row, field) {
    const value = date(row, field);
    return value && value.slice(5, 7) + "/" + value.slice(8, 10) + "/" + value.slice(0, 4);
}

function text(row, field) {
    const value = row[field];
    return value === "" || value === null || value === undefined ? null : String(value).trim();
}

const MAPPERS = {
    Hardware: (row) => ({
        model: text(row, "model"),
        lod: date(row, "last_order_day"),
        armb: date(row, "arm_begin"),
        arme: date(row, "arm_end"),
        oneyldo: date(row, "one_year_ldo"),
        lrmb: date(row, "lrm_begin"),
        lrme: date(row, "lrm_end"),
        eos: date(row, "end_of_support"),
        sortid: row.sorting_id
    }),
    Firmware: (row) => ({
        release: text(row, "release"),
        model: text(row, "model") || "",
        type: text(row, "type_label"),
        rd: usDate(row, "release_date"),
        status: text(row, "status"),
        upgrade: text(row, "recommended_upgrade"),
        eos: date(row, "end_of_support"),
        sortid: row.sorting_id
    })
};

/**
 * Reads the lifecycle tables out of the page. It is a Next.js page: the data travels in the React flight payload,
 * pushed in string chunks by self.__next_f.push([1, "..."]), as an array of [series name, { type: [rows] }].
 * @param {string} html The page
 * @returns {Array} [[series name, { "<type>": [row, ...] }], ...]
 */
function extractTables(html) {
    const chunk = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g;
    let flight = "";
    let match;
    while ((match = chunk.exec(html))) {
        flight += JSON.parse(match[1]);
    }
    const firstRow = flight.indexOf("\"sorting_id\"");
    if (firstRow === -1) {
        throw new Error("No lifecycle rows in the page: its format has changed");
    }
    const start = flight.lastIndexOf(":[[\"", firstRow) + 1;
    const end = flight.indexOf("\n", start);
    let tables;
    try {
        tables = JSON.parse(flight.slice(start, end === -1 ? undefined : end));
    } catch (e) {
        throw new Error("The lifecycle data in the page is not the expected JSON: " + e.message);
    }
    if (!Array.isArray(tables) || tables.length === 0) {
        throw new Error("The lifecycle data in the page is not a list of series");
    }
    let rowCount = 0;
    tables.forEach((series) => {
        if (!Array.isArray(series) || typeof series[0] !== "string" || !series[1] || typeof series[1] !== "object") {
            throw new Error("Unexpected series entry: " + JSON.stringify(series).slice(0, 200));
        }
        Object.keys(series[1]).forEach((type) => {
            if (KNOWN_TYPES.indexOf(type) === -1) {
                throw new Error(series[0] + ": unknown table type " + JSON.stringify(type));
            }
            if (!Array.isArray(series[1][type])) {
                throw new Error(series[0] + " " + type + ": the rows are not a list");
            }
            rowCount += series[1][type].length;
            series[1][type].forEach((row) => {
                if (!row || typeof row.sorting_id !== "string" || !row.sorting_id) {
                    throw new Error(series[0] + " " + type + ": a row has no sorting_id");
                }
                if (type === "Hardware" && !text(row, "model")) {
                    throw new Error(row.sorting_id + ": a Hardware row has no model");
                }
            });
        });
    });
    // Rows anywhere else in the payload (another flight line, a second list) would be silently left behind.
    const pageRows = flight.split("\"sorting_id\"").length - 1;
    if (pageRows !== rowCount) {
        throw new Error("The page lists " + pageRows + " rows but only " + rowCount + " were read: its format has changed");
    }
    return tables;
}

function seriesKey(name, current) {
    if (SERIES_OVERRIDES[name]) {
        return SERIES_OVERRIDES[name];
    }
    if (current["SonicWall " + name]) {
        return "SonicWall " + name;
    }
    return current[name] ? name : "SonicWall " + name;
}

const bySortid = (a, b) => a.sortid.localeCompare(b.sortid, "en", { numeric: true });
const byModelLength = (a, b) => a.model.length - b.model.length || bySortid(a, b);

function renumber(rows) {
    const table = {};
    rows.forEach((row, i) => { table[i] = row; });
    return table;
}

/**
 * Merges the page's tables into the file's.
 * @param {object} current The file's content
 * @param {Array} live The page's tables, as extractTables returns them
 * @returns {{ table: object, changes: string[] }} The new file content and one line per change
 */
function mergeTables(current, live) {
    const changes = [];
    const merged = {};
    Object.keys(current).forEach((key) => { merged[key] = Object.assign({}, current[key]); });

    live.forEach(([name, types]) => {
        const key = seriesKey(name, merged);
        REFRESHED_TYPES.forEach((type) => {
            if (!types[type] || types[type].length === 0) {
                return;
            }
            if (!merged[key]) {
                merged[key] = {};
                changes.push("new series " + key);
            }
            const existing = merged[key][type] || {};
            const rows = Object.keys(existing).map((k) => existing[k]);
            types[type].forEach((liveRow) => {
                const row = MAPPERS[type](liveRow);
                const at = rows.findIndex((r) => r.sortid === row.sortid);
                if (at === -1) {
                    rows.push(row);
                    changes.push(key + " " + type + ": added " + row.sortid + " " + row.model);
                } else if (JSON.stringify(rows[at]) !== JSON.stringify(row)) {
                    rows[at] = row;
                    changes.push(key + " " + type + ": updated " + row.sortid + " " + row.model);
                }
            });
            if (type === "Hardware") {
                rows.sort(byModelLength);
            }
            merged[key][type] = renumber(rows);
        });
        // Hardware first, then Firmware, then whatever else the series has, in its order.
        if (merged[key]) {
            const others = Object.keys(merged[key]).filter((t) => REFRESHED_TYPES.indexOf(t) === -1);
            const reordered = {};
            REFRESHED_TYPES.concat(others).forEach((t) => {
                if (merged[key][t]) {
                    reordered[t] = merged[key][t];
                }
            });
            merged[key] = reordered;
        }
    });
    return { table: merged, changes };
}

/**
 * The tables for driver copies before 1.0.4: Hardware rows missing a date they show are left out, so such a
 * model keeps failing as "not found" instead of reporting 0 days to an unpublished date. A Hardware table left
 * empty stays, so those copies don't fall through to the series' Firmware table.
 * @param {object} table The full tables
 * @returns {{ table: object, omitted: string[] }} The tables and the sortid and model of each row left out
 */
function legacyTables(table) {
    const omitted = [];
    const legacy = {};
    Object.keys(table).forEach((key) => {
        legacy[key] = Object.assign({}, table[key]);
        const hardware = table[key].Hardware;
        if (hardware) {
            const rows = Object.keys(hardware).map((k) => hardware[k]);
            const complete = rows.filter((row) => LEGACY_DATES.every((field) => row[field]));
            rows.filter((row) => complete.indexOf(row) === -1).forEach((row) => omitted.push(row.sortid + " " + row.model));
            legacy[key].Hardware = renumber(complete);
        }
    });
    return { table: legacy, omitted };
}

// The site is behind a bot filter that answers a script's user agent with a challenge page instead of the data.
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

async function fetchPage() {
    const response = await fetch(PAGE_URL, { headers: { "User-Agent": BROWSER_UA } });
    if (!response.ok) {
        throw new Error(PAGE_URL + " answered " + response.status);
    }
    const html = await response.text();
    if (html.indexOf("self.__next_f.push") === -1) {
        throw new Error("SonicWall's site did not send the lifecycle page (bot protection?): save "
            + PAGE_URL + " from a browser and pass the file's path");
    }
    return html;
}

async function main(args) {
    const check = args.indexOf("--check") !== -1;
    const file = args.find((a) => a !== "--check");
    const html = file ? fs.readFileSync(file, "utf8") : await fetchPage();
    const current = JSON.parse(fs.readFileSync(TABLE_FILE, "utf8"));
    const { table, changes } = mergeTables(current, extractTables(html));
    const legacy = legacyTables(table);
    changes.forEach((line) => console.log(line));
    console.log(changes.length + " change(s)");
    console.log(legacy.omitted.length + " Hardware row(s) with unpublished dates left out of "
        + path.basename(LEGACY_FILE) + ": " + legacy.omitted.join(", "));
    if (!check) {
        fs.writeFileSync(TABLE_FILE, JSON.stringify(table, null, 2) + "\n");
        fs.writeFileSync(LEGACY_FILE, JSON.stringify(legacy.table, null, 2) + "\n");
        console.log("written " + path.relative(process.cwd(), TABLE_FILE) + " and " + path.relative(process.cwd(), LEGACY_FILE));
    }
}

module.exports = { extractTables, mergeTables, legacyTables };

if (require.main === module) {
    main(process.argv.slice(2)).catch((e) => {
        console.error(e.message);
        process.exit(1);
    });
}
