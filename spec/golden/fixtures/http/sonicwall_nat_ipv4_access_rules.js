// Simulated SonicWall TZ270 (SonicOS 7.0.1) replies. Shape follows the SonicOS 7 API: POST /api/sonicos/auth
// (basic auth) then GET /api/sonicos/access-rules/ipv4, { access_rules: [{ ipv4: { name, uuid, comment, enable,
// action, from, to, source: { address, port }, destination: { address, port }, service, ... } }] } where an
// address is one of { any: true } | { name: "<object>" } | { group: "<group>" } and a port { any: true } | { name }.
const reply = require("../../replies");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };

const RULES = {
    access_rules: [
        {
            ipv4: {
                name: "LAN to WAN allow", uuid: "2d1c6b0a-7e55-4f6b-9a31-0c7f1d3b5a01", comment: "Default outbound", enable: true,
                action: "allow", from: "LAN", to: "WAN",
                source: { address: { any: true }, port: { any: true } },
                destination: { address: { any: true } },
                service: { any: true }
            }
        },
        {
            ipv4: {
                name: "WAN to DMZ web", uuid: "8c93f5de-12aa-4b1f-8f0e-5a6d7c8e9b02", comment: "Published web server", enable: true,
                action: "allow", from: "WAN", to: "DMZ",
                source: { address: { any: true }, port: { any: true } },
                destination: { address: { name: "DMZ Web Server" } },
                service: { name: "HTTPS" }
            }
        },
        {
            ipv4: {
                name: "Block guest to LAN", uuid: "f3a1d2c4-9b8e-4c7d-a6f5-1e2d3c4b5a03", enable: false,
                action: "deny", from: "DMZ", to: "LAN",
                source: { address: { group: "Guest Hosts" }, port: { any: true } },
                destination: { address: { name: "X0 Subnet" } },
                service: { any: true }
            }
        }
    ]
};

const calls = [
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
    { kind: "http", method: "get", target: "/api/sonicos/access-rules/ipv4", reply: reply.http(200, RULES, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "tz270 all access rules",
        parameters: { accessRuleName: ["ALL"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }, {
        name: "tz270 selected access rules",
        parameters: { accessRuleName: ["WAN to DMZ web", "block guest to lan"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
