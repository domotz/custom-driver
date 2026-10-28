// Simulated Ubiquiti EdgeOS (EdgeRouter, v2.0.9) replies. Shape follows the EdgeOS web UI back end: POST / with
// the credentials form sets the session cookie (answered with a redirect), then GET
// /api/edge/data.json?data=dhcp_leases answers { success: "1", output: { "dhcp-server-leases": { <shared network
// name>: { <ip>: { mac, expiration ("YYYY/MM/DD HH:MM:SS"), pool, "client-hostname" } } } } }.
// The driver reads only the shared network called "HomeRouter"; the fixture adds a "Guest" network to show it
// is ignored.
const reply = require("../../replies");

const lease = (mac, expiration, host) => ({ mac, expiration, pool: "LAN", "client-hostname": host });

const LEASES = { success: "1", output: { "dhcp-server-leases": {
    HomeRouter: {
        "192.168.1.101": lease("b8:27:eb:12:34:56", "2026/01/15 18:23:41", "raspberrypi"),
        "192.168.1.102": lease("3c:22:fb:aa:bb:cc", "2026/01/16 02:05:09", "macbook-pro"),
        "192.168.1.130": lease("f0:18:98:01:02:03", "2026/01/15 10:30:00", "iphone")
    },
    Guest: { "192.168.50.20": lease("dc:a6:32:11:22:33", "2026/01/15 12:00:00", "guest-laptop") }
} } };

const calls = () => [
    { kind: "http", method: "post", target: "/", body: "username=user&password=pass", reply: reply.http(303, "", { location: "/" }) },
    { kind: "http", method: "get", target: "/api/edge/data.json?data=dhcp_leases", reply: reply.http(200, LEASES, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{ name: "edgerouter with a HomeRouter network", entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } } }]
};
