// Simulated SonicWall TZ370W (SonicOS 7.1.1) replies. Shape follows the SonicOS 7 API: POST /api/sonicos/auth
// (basic auth, { status: { success, info } } envelope) and GET /api/sonicos/reporting/dhcp-server/ipv4/leases/statistic,
// a flat JSON object of lease counters. The SonicOS schema spells the keys "avaliable_dynamic" and
// "avaliable_static_" (sic); the driver reads exactly those, the trailing underscore is not confirmed by a capture.
const reply = require("../../replies");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };

const STATS = { current: 37, avaliable_dynamic: 163, avaliable_static_: 12, total_active: 49, total_configured: 212 };

const calls = [
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
    { kind: "http", method: "get", target: "/api/sonicos/reporting/dhcp-server/ipv4/leases/statistic", reply: reply.http(200, STATS, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "tz370w leases",
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
