// Simulated OPNsense 23.7 replies. Shape follows the OPNsense API reference (core/routes): the gateway status endpoint
// /api/routes/gateway/status (the driver POSTs it, with the API key and secret as basic auth) returns
// { items: [{ name, address, status, status_translated, loss, stddev, delay, monitor }], status: "ok" }, loss and
// stddev being text with their unit ("0.0 %", "0.3 ms") and "~" when the monitor has no data.
const reply = require("../../replies");

const GATEWAYS = {
    items: [
        { name: "WAN_GW", address: "203.0.113.1", status: "none", status_translated: "Online", loss: "0.0 %", stddev: "0.3 ms", delay: "5.1 ms", monitor: "203.0.113.1" },
        { name: "BACKUP_LTE", address: "100.64.12.1", status: "down", status_translated: "Offline", loss: "100.0 %", stddev: "0.0 ms", delay: "0.0 ms", monitor: "100.64.12.1" },
        { name: "VPN_GW", address: "10.8.0.1", status: "loss", status_translated: "Danger, Packetloss: 12.5%", loss: "12.5 %", stddev: "14.8 ms", delay: "48.2 ms", monitor: "10.8.0.1" }
    ],
    status: "ok"
};

function calls() {
    return [{ kind: "http", method: "post", target: "/api/routes/gateway/status", reply: reply.http(200, GATEWAYS, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "opnsense 23.7 gateways",
        parameters: { portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
