// Simulated SonicWall NSv 25 (SonicOS 7.0.1) replies. Shape follows the SonicOS 7 API: POST /api/sonicos/auth
// (basic auth), GET /api/sonicos/reporting/status/system ({ model: "NSv 25", firmware_version, serial_number, ... })
// and the product lifecycle table the driver downloads from raw.githubusercontent.com
// (domotz/custom-driver resources/sonicwall-plc-tables-v2.json): { "<family>": { "<Hardware|Firmware>": { "<n>":
// { model, lod, armb, arme, oneyldo, lrmb, lrme, eos, sortid } } } }. The table below is a trimmed copy of the real
// file. Its TZ family lists Firmware before Hardware, as the file did before BT-6931, and its TZ470 row has only
// the date SonicWall has published (the others are null), as in the file today. TZ 370 is a current model the
// file does not list.
const reply = require("../../replies");
const { bearerCases } = require("../../sonicwall-bearer");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };

const system = (model) => ({
    model, firmware_version: "SonicOS Enhanced 7.0.1-5145", rom_version: "SonicROM 5.0.0.0", serial_number: "18B169ABCDEF",
    up_time: "12 Days 03:21:10"
});

const phases = (model, sortid, lod, armb, arme, oneyldo, lrmb, lrme, eos) => ({ model, lod, armb, arme, oneyldo, lrmb, lrme, eos, sortid });

const PLC = {
    "SonicWall NSA Series": {
        Hardware: {
            0: phases("2600", "SWNSA-H-27", "2019-03-07", "2019-03-08", "2021-03-07", "2023-03-07", "2021-03-08", "2024-03-07", "2024-03-08"),
            62: phases("3600", "SWNSA-H-29", "2021-03-02", "2021-03-03", "2023-03-02", "2025-03-02", "2023-03-03", "2026-03-02", "2026-03-03")
        }
    },
    "SonicWall TZ Series": {
        Firmware: {
            0: phases("SOHOW, TZ300, TZ300W, TZ400, TZ400W, TZ500, TZ500W, TZ600", "SWTZ-F-01", "2019-03-07", "2019-03-08", "2021-03-07", "2023-03-07", "2021-03-08", "2024-03-07", "2024-03-08"),
            1: phases("SOHOW, SOHO 250, SOHO 250W, TZ300, TZ300P, TZ300W, TZ350, TZ350W, TZ400, TZ400W, TZ500, TZ500W, TZ600, TZ600P", "SWTZ-F-02", "2023-06-30", "2023-07-01", "2025-06-30", "2027-06-30", "2025-07-01", "2028-06-30", "2028-07-01")
        },
        Hardware: {
            0: phases("350", "SWTZ-H-20", "2023-09-30", "2023-10-01", "2025-09-30", "2027-09-30", "2025-10-01", "2028-09-30", "2028-10-01"),
            1: phases("TZ470", "SWTZ-H-65", "2026-06-30", null, null, null, null, null, null)
        }
    },
    "SonicWall NSv Series": {
        Hardware: {
            220: phases("10", "SWNSV-A-10", "2022-04-15", "2022-04-16", "2024-04-15", "2025-04-15", "2024-04-16", "2026-04-15", "2026-04-16"),
            221: phases("25", "SWNSV-A-12", "2022-04-15", "2022-04-16", "2024-04-15", "2025-04-15", "2024-04-16", "2026-04-15", "2026-04-16"),
            223: phases("100", "SWNSV-A-14", "2027-04-15", "2027-04-16", "2029-04-15", "2030-04-15", "2029-04-16", "2031-04-15", "2031-04-16")
        }
    }
};

function calls(model) {
    return [
        { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
        { kind: "http", method: "get", target: "/api/sonicos/reporting/status/system", reply: reply.http(200, system(model), { "content-type": "application/json" }) },
        { kind: "http", method: "get", host: "raw.githubusercontent.com", target: "/domotz/custom-driver/master/resources/sonicwall-plc-tables-v2.json", reply: reply.http(200, PLC) }
    ];
}

// The remaining days of a date SonicWall has not published have no value.
const UNPUBLISHED = {
    "TZ470": ["arm-remaining-days", "one-year-lod-remaining-days", "lrm-remaining-days", "eos-remaining-days"],
    "TZ 370": ["lod-remaining-days", "arm-remaining-days", "one-year-lod-remaining-days", "lrm-remaining-days", "eos-remaining-days"]
};

function getStatus(model) {
    const entryPoint = { calls: calls(model) };
    if (UNPUBLISHED[model]) {
        entryPoint.expect = { nullValues: UNPUBLISHED[model] };
    }
    return entryPoint;
}

module.exports = {
    cases: ["NSv 25", "NSv 100", "NSA 3600", "TZ 350", "TZ470", "TZ 370"].map((model) => ({
        name: "sonicwall " + model,
        parameters: {},
        entryPoints: { validate: { calls: calls(model) }, get_status: getStatus(model) }
    }))
};

// The same device with the SonicOS bearer token session check on (see ../../sonicwall-bearer.js).
module.exports.cases = module.exports.cases.concat(bearerCases(module.exports.cases));
