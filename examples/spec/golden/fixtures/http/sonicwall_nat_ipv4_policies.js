// Simulated SonicWall TZ270 (SonicOS 7.0.1) replies. Shape follows the SonicOS 7 API: POST /api/sonicos/auth
// (basic auth) then GET /api/sonicos/nat-policies/ipv4, { nat_policies: [{ ipv4: { name, uuid, comment, enable,
// inbound, outbound, source: { original, translated }, destination: { original, translated },
// service: { original, translated }, ... } }] } with address object names ("any", "original", "X1 IP", ...).
const reply = require("../../replies");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };

const POLICIES = {
    nat_policies: [
        {
            ipv4: {
                name: "WAN to LAN masquerade", uuid: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01", comment: "Default NAT policy", enable: true,
                inbound: "any", outbound: "X1",
                source: { original: "X0 Subnet", translated: "X1 IP" },
                destination: { original: "any", translated: "original" },
                service: { original: "any", translated: "original" }
            }
        },
        {
            ipv4: {
                name: "Web server inbound", uuid: "1b2c3d4e-5f6a-4b7c-9d8e-0f1a2b3c4d02", enable: true,
                inbound: "X1", outbound: "any",
                source: { original: "any", translated: "original" },
                destination: { original: "X1 IP", translated: "DMZ Web Server" },
                service: { original: "HTTPS", translated: "original" }
            }
        },
        {
            ipv4: {
                name: "Legacy FTP", uuid: "2c3d4e5f-6a7b-4c8d-ae9f-1a2b3c4d5e03", comment: "disabled after migration", enable: false,
                inbound: "X1", outbound: "any",
                source: { original: "any", translated: "original" },
                destination: { original: "X1 IP", translated: "DMZ FTP" },
                service: { original: "FTP", translated: "original" }
            }
        }
    ]
};

const calls = [
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
    { kind: "http", method: "get", target: "/api/sonicos/nat-policies/ipv4", reply: reply.http(200, POLICIES, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "tz270 all nat policies",
        parameters: { policy_name: ["ALL"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }, {
        name: "tz270 selected nat policies",
        parameters: { policy_name: ["Web server inbound", "legacy ftp"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
