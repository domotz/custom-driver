// Simulated SonicWall NSv 270 (SonicOS 7.0.1) replies. Shape follows the SonicOS 7 API: POST /api/sonicos/auth
// (basic auth, { status: { success, info } } envelope) and GET /api/sonicos/dynamic-file/getDashboardData.json,
// read by the driver as a JSON object keyed by service id (gav, spyw, ips, ...) with boolean status and licensed.
// The full dashboard payload is not published; only the keys the driver reads (plus a few unrelated ones) are simulated.
const reply = require("../../replies");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };

const svc = (status, licensed) => ({ status, licensed });
const DASHBOARD = {
    gav: svc(true, true), spyw: svc(true, true), ips: svc(true, true), geoip: svc(true, true), botnet: svc(false, true),
    appctrl: svc(true, true), dpissl: svc(false, false), dpissh: svc(false, false), cfs: svc(true, true),
    cass: svc(false, false), cees: svc(false, false), capture: svc(true, false),
    firmware: { version: "SonicOS Enhanced 7.0.1-5119" }
};

const calls = [
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
    { kind: "http", method: "get", target: "/api/sonicos/dynamic-file/getDashboardData.json", reply: reply.http(200, DASHBOARD, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "nsv270 all services",
        parameters: { servicesToMonitor: ["ALL"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }, {
        name: "nsv270 selected services",
        parameters: { servicesToMonitor: ["gav", "BOTNET", "capture"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
