/**
 * SonicWall product lifecycle driver (BT-6931), run against the real lifecycle tables in this checkout, the files
 * installed copies download from master: resources/sonicwall-plc-tables-v2.json (this version) and
 * resources/sonicwall-plc-tables.json (copies before 1.0.4).
 *
 * Each SonicOS model string must resolve to its own Hardware row: Gen 7 models however SonicOS spaces or cases
 * them, a model whose name starts another's ("TZ 400" is not the TZ 400W), a family the table lists with Firmware
 * rows first, and SonicWall's long spellings ("SuperMassive 9200", "TZ 350 Wireless"). A firewall model SonicWall
 * has not published reports N/A dates instead of failing; anything else is a parsing error that names the model.
 * Older copies count an unpublished date as 0 days remaining, so their file must never give them one.
 */
const fs = require("fs");
const path = require("path");
const { discoverDrivers } = require("./net/catalogue");
const { runEntryPoint } = require("./net/run-driver");
const { deterministicGlobals } = require("./golden/clock");
const reply = require("./golden/replies");

const EXAMPLES = path.join(__dirname, "..", "examples");
const RESOURCES = path.join(__dirname, "..", "resources");
const TABLE = JSON.parse(fs.readFileSync(path.join(RESOURCES, "sonicwall-plc-tables-v2.json"), "utf8"));
const LEGACY_TABLE = JSON.parse(fs.readFileSync(path.join(RESOURCES, "sonicwall-plc-tables.json"), "utf8"));
const PLC_URL = "/domotz/custom-driver/master/resources/sonicwall-plc-tables-v2.json";
const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };
const driver = discoverDrivers(EXAMPLES).find((d) => d.path === "http/sonicwall_firewall_product_lifecycle.js");

// Lifecycle phase -> [date variable, remaining-days variable]
const PHASES = {
    lod: ["lod", "lod-remaining-days"],
    armb: ["arm", "arm-remaining-days"],
    oneyldo: ["one-year-lod", "one-year-lod-remaining-days"],
    lrmb: ["lrm", "lrm-remaining-days"],
    eos: ["eos", "eos-remaining-days"]
};

function hardwareRow(sortid) {
    for (const family of Object.keys(TABLE)) {
        const rows = TABLE[family].Hardware || {};
        const key = Object.keys(rows).find((k) => rows[k].sortid === sortid);
        if (key !== undefined) {
            return rows[key];
        }
    }
    return undefined;
}

// A firewall reporting `model`, and the lifecycle table served as raw.githubusercontent.com serves it.
function responder(model) {
    return (call) => {
        const url = call.options && call.options.url;
        if (call.host === "raw.githubusercontent.com" && url === PLC_URL) {
            return reply.http(200, TABLE);
        }
        if (!call.host && call.method === "post" && url === "/api/sonicos/auth") {
            return reply.http(200, AUTH);
        }
        if (!call.host && call.method === "get" && url === "/api/sonicos/reporting/status/system") {
            return reply.http(200, { model, firmware_version: "SonicOS 7.1.1-7040", serial_number: "18B169ABCDEF" }, { "content-type": "application/json" });
        }
        return undefined;
    };
}

async function run(model) {
    const result = await runEntryPoint({
        source: driver.source,
        filename: path.basename(driver.path),
        entryPoint: "get_status",
        responder: responder(model),
        parameters: {},
        driverType: driver.driverType,
        globals: deterministicGlobals(),
        timeLimitMs: 2000
    });
    const report = result.firstReport || {};
    const values = {};
    (report.variables || []).forEach((v) => { values[v.uid] = v.value; });
    const logs = result.logs.map((entry) => entry.level + " " + entry.args.join(" "));
    return { report, values, logs };
}

describe("SonicWall product lifecycle against the published table", () => {
    // Remaining days count from midnight UTC; the driver reads dates in the process's time zone.
    let savedTz;
    beforeAll(() => {
        savedTz = process.env.TZ;
        process.env.TZ = "UTC";
    });
    afterAll(() => {
        if (savedTz === undefined) {
            delete process.env.TZ;
        } else {
            process.env.TZ = savedTz;
        }
    });

    [
        { model: "TZ 470", sortid: "SWTZ-H-65", what: "a Gen 7 TZ" },
        { model: "TZ470", sortid: "SWTZ-H-65", what: "a Gen 7 TZ written without a space" },
        { model: "NSa 2700", sortid: "SWNSA-H-28", what: "a Gen 7 NSa in SonicWall's mixed case" },
        { model: "NSv 270", sortid: "SWNSV-A-27", what: "a Gen 7 NSv" },
        { model: "NSa 2650", sortid: "SWNSA-H-37", what: "a Gen 6 NSa in mixed case" },
        { model: "TZ 400", sortid: "SWTZ-H-43", what: "a model whose name starts another's (TZ 400W)" },
        { model: "TZ 350", sortid: "SWTZ-H-39", what: "a TZ, whose family also lists Firmware rows" },
        { model: "SM 9200", sortid: "SWSM-H-5", what: "a SuperMassive" },
        { model: "SuperMassive 9200", sortid: "SWSM-H-5", what: "a SuperMassive spelled out" },
        { model: "TZ 350 Wireless", sortid: "SWTZ-H-41", what: "a wireless TZ spelled out (the table's 350W)" }
    ].forEach(({ model, sortid, what }) => {
        it("reports the lifecycle row of " + what + ' ("' + model + '" -> ' + sortid + ")", async () => {
            const row = hardwareRow(sortid);
            expect(row).withContext("row " + sortid + " in the table").toBeDefined();
            const { report, values, logs } = await run(model);
            expect(report.type).withContext(logs.join("\n")).toBe("success");
            Object.keys(PHASES).forEach((phase) => {
                const [dateUid, daysUid] = PHASES[phase];
                const date = (row && row[phase]) || "N/A";
                expect(values[dateUid]).withContext(dateUid).toBe(date);
                if (date === "N/A") {
                    expect(values[daysUid]).withContext(daysUid + " of an unpublished date").toBeNull();
                } else {
                    expect(typeof values[daysUid]).withContext(daysUid).toBe("number");
                }
            });
        });
    });

    it("reports N/A dates, with a warning naming the model, for a firewall SonicWall has not published", async () => {
        const { report, values, logs } = await run("TZ 370");
        expect(report.type).withContext(logs.join("\n")).toBe("success");
        Object.keys(PHASES).forEach((phase) => {
            const [dateUid, daysUid] = PHASES[phase];
            expect(values[dateUid]).withContext(dateUid).toBe("N/A");
            expect(values[daysUid]).withContext(daysUid).toBeNull();
        });
        expect(logs.some((line) => /^warn .*TZ 370/.test(line))).withContext(logs.join("\n")).toBe(true);
    });

    [
        { model: "XYZ 100", what: "a model of no known family" },
        { model: "NSa 2650 HA", what: "a known family's model with words the table doesn't list" }
    ].forEach(({ model, what }) => {
        it("reports a parsing error naming the model for " + what + ' ("' + model + '")', async () => {
            const { report, logs } = await run(model);
            expect(report.type).withContext(logs.join("\n")).toBe("failure");
            expect(report.errorType).toBe("PARSING_ERROR");
            expect(logs.some((line) => line.indexOf("error ") === 0 && line.indexOf(model) !== -1)).withContext(logs.join("\n")).toBe(true);
        });
    });
});

describe("SonicWall lifecycle table for driver copies before 1.0.4", () => {
    const LEGACY_DATES = ["lod", "armb", "oneyldo", "lrmb", "eos"];

    it("gives every Hardware row all five dates those copies show", () => {
        const partial = [];
        Object.keys(LEGACY_TABLE).forEach((family) => {
            const rows = LEGACY_TABLE[family].Hardware || {};
            Object.keys(rows).forEach((k) => {
                if (!LEGACY_DATES.every((field) => rows[k][field])) {
                    partial.push(family + " " + rows[k].sortid);
                }
            });
        });
        expect(partial).toEqual([]);
    });

    it("lists Hardware first in every family that has it, as those copies read the first table", () => {
        Object.keys(LEGACY_TABLE).forEach((family) => {
            const types = Object.keys(LEGACY_TABLE[family]);
            if (types.indexOf("Hardware") !== -1) {
                expect(types[0]).withContext(family).toBe("Hardware");
            }
        });
    });

    it("holds every complete row of this version's table, unchanged", () => {
        Object.keys(TABLE).forEach((family) => {
            const rows = TABLE[family].Hardware || {};
            const legacyRows = Object.values((LEGACY_TABLE[family] || {}).Hardware || {});
            Object.values(rows).filter((row) => LEGACY_DATES.every((field) => row[field])).forEach((row) => {
                expect(legacyRows.find((r) => r.sortid === row.sortid)).withContext(family + " " + row.sortid).toEqual(row);
            });
        });
    });
});
