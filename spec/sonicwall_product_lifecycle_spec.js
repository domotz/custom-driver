/**
 * SonicWall product lifecycle driver (BT-6931), run against the real lifecycle table: the
 * resources/sonicwall-plc-tables.json in this checkout, the file every installed copy downloads from master.
 *
 * Each SonicOS model string must resolve to its own Hardware row: Gen 7 models however SonicOS spaces or cases
 * them, a model whose name starts another's ("TZ 400" is not the TZ 400W), a family the table lists with Firmware
 * rows first, and the SuperMassive family. A model of a known firewall family that SonicWall has not published
 * reports N/A dates instead of failing; a model of no known family is a parsing error that names the model.
 */
const fs = require("fs");
const path = require("path");
const { discoverDrivers } = require("./net/catalogue");
const { runEntryPoint } = require("./net/run-driver");
const { deterministicGlobals } = require("./golden/clock");
const reply = require("./golden/replies");

process.env.TZ = "UTC";

const EXAMPLES = path.join(__dirname, "..", "examples");
const TABLE = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "resources", "sonicwall-plc-tables.json"), "utf8"));
const PLC_URL = "/domotz/custom-driver/master/resources/sonicwall-plc-tables.json";
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
    [
        { model: "TZ 470", sortid: "SWTZ-H-65", what: "a Gen 7 TZ" },
        { model: "TZ470", sortid: "SWTZ-H-65", what: "a Gen 7 TZ written without a space" },
        { model: "NSa 2700", sortid: "SWNSA-H-28", what: "a Gen 7 NSa in SonicWall's mixed case" },
        { model: "NSv 270", sortid: "SWNSV-A-27", what: "a Gen 7 NSv" },
        { model: "NSa 2650", sortid: "SWNSA-H-37", what: "a Gen 6 NSa in mixed case" },
        { model: "TZ 400", sortid: "SWTZ-H-43", what: "a model whose name starts another's (TZ 400W)" },
        { model: "TZ 350", sortid: "SWTZ-H-39", what: "a TZ, whose family also lists Firmware rows" },
        { model: "SM 9200", sortid: "SWSM-H-5", what: "a SuperMassive" }
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

    it("reports a parsing error naming the model for a model of no known family", async () => {
        const { report, logs } = await run("XYZ 100");
        expect(report.type).toBe("failure");
        expect(report.errorType).toBe("PARSING_ERROR");
        expect(logs.some((line) => /^error .*XYZ 100/.test(line))).withContext(logs.join("\n")).toBe(true);
    });
});
