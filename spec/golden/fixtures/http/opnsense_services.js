// Simulated OPNsense 23.7 replies. Shape follows the OPNsense API reference (core/service): GET
// /api/core/service/search returns { total, rowCount, current, rows: [{ id, locked, running, description, name }] }
// with running as 1 or 0. The "all" pseudo-row is not part of the real reply (the driver skips it anyway).
const reply = require("../../replies");

const SERVICES = {
    total: 5, rowCount: 5, current: 1,
    rows: [
        { id: "configd", locked: 1, running: 1, description: "System Configuration Daemon", name: "configd" },
        { id: "dhcpd", locked: 0, running: 1, description: "DHCPv4 Server", name: "dhcpd" },
        { id: "unbound", locked: 0, running: 1, description: "Unbound DNS", name: "unbound" },
        { id: "openvpn", locked: 0, running: 0, description: "OpenVPN", name: "openvpn" },
        { id: "ntpd", locked: 0, running: 1, description: "Network Time Daemon", name: "ntpd" }
    ]
};

function calls() {
    return [{ kind: "http", method: "get", target: "/api/core/service/search", reply: reply.http(200, SERVICES, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "opnsense 23.7 all services",
        parameters: { serviceName: ["ALL"], portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }, {
        name: "opnsense 23.7 services matching a name",
        parameters: { serviceName: ["vpn", "dhcp"], portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
