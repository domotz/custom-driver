// Simulated SonicWall TZ270 (SonicOS 7.0.1) replies. Shape follows the SonicOS 7 API on the SSL VPN port (8444):
// POST /api/sonicos/auth (basic auth, { status: { success, info } } envelope) and
// GET /api/sonicos/reporting/ssl-vpn/sessions, a JSON array of sessions with user_name, client_virtual_ip,
// client_wan_ip and logged_in. logged_in is "MM/DD/YYYY HH:MM:SS", as production stores it.
const reply = require("../../replies");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };

const SESSIONS = [
    { user_name: "mrossi", client_virtual_ip: "192.168.200.11", client_wan_ip: "84.220.14.7", logged_in: "01/15/2026 08:12:41" },
    { user_name: "Anna Bianchi", client_virtual_ip: "192.168.200.12", client_wan_ip: "151.38.2.190", logged_in: "01/14/2026 17:55:03" }
];

const calls = [
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
    { kind: "http", method: "get", target: "/api/sonicos/reporting/ssl-vpn/sessions", reply: reply.http(200, SESSIONS, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "tz270 two sessions",
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
