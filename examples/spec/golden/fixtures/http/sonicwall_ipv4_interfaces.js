// Simulated SonicWall TZ270 (SonicOS 7.0.1) replies. Shape follows the SonicOS 7 API: POST /api/sonicos/auth
// (basic auth, { status: { success, info } } envelope) and GET /api/sonicos/interfaces/ipv4, a JSON object
// { interfaces: [{ ipv4: { name, comment, ip_assignment: { zone, mode: { static: { ip, netmask, gateway } } },
// management: { https, ping, snmp, ssh }, user_login: { http, https } } }] }. X1 is a DHCP WAN (mode.dhcp, no
// static block) and X3 has no ip_assignment, as unassigned ports have in the SonicOS interface list.
const reply = require("../../replies");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };

const INTERFACES = {
    interfaces: [
        {
            ipv4: {
                name: "X0", comment: "Office LAN",
                ip_assignment: { zone: "LAN", mode: { static: { ip: "192.168.168.168", netmask: "255.255.255.0" } } },
                management: { https: true, ping: true, snmp: true, ssh: false },
                user_login: { http: false, https: true }
            }
        },
        {
            ipv4: {
                name: "X1",
                ip_assignment: { zone: "WAN", mode: { dhcp: { hostname: "tz270", dns: { primary: "8.8.8.8" } } } },
                management: { https: false, ping: true, snmp: false, ssh: false },
                user_login: { http: false, https: false }
            }
        },
        {
            ipv4: {
                name: "X2", comment: "Guest",
                ip_assignment: { zone: "DMZ", mode: { static: { ip: "10.20.30.1", netmask: "255.255.255.0", gateway: "10.20.30.254" } } },
                management: { https: true, ping: false, snmp: false, ssh: true },
                user_login: { http: true, https: true }
            }
        },
        { ipv4: { name: "X3" } }
    ]
};

const calls = [
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
    { kind: "http", method: "get", target: "/api/sonicos/interfaces/ipv4", reply: reply.http(200, INTERFACES, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "tz270 all interfaces",
        parameters: { interfaceName: ["ALL"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }, {
        name: "tz270 selected interfaces",
        parameters: { interfaceName: ["x0", "X2"] },
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
