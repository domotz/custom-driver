// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsportfc (-json), an array.
// Format notes: port_speed is "16Gb" (value + unit) or "N/A" for a port without a link; attachment
// switch/host/none; status active/inactive_unconfigured/inactive_configured; nportid is a hex string.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsportfc = [
    { id: "0", fc_io_port_id: "1", port_id: "1", type: "fc", port_speed: "16Gb", node_id: "1", node_name: "node1", WWPN: "500507680C110001", nportid: "010200", status: "active", attachment: "switch", cluster_use: "local_partner", adapter_location: "1", adapter_port_id: "1" },
    { id: "1", fc_io_port_id: "2", port_id: "2", type: "fc", port_speed: "32Gb", node_id: "1", node_name: "node1", WWPN: "500507680C120001", nportid: "010300", status: "active", attachment: "host", cluster_use: "local_partner", adapter_location: "1", adapter_port_id: "2" },
    { id: "2", fc_io_port_id: "1", port_id: "1", type: "fc", port_speed: "8Gb", node_id: "2", node_name: "node2", WWPN: "500507680C110002", nportid: "010400", status: "active", attachment: "switch", cluster_use: "local_partner", adapter_location: "1", adapter_port_id: "1" },
    { id: "3", fc_io_port_id: "2", port_id: "2", type: "fc", port_speed: "N/A", node_id: "2", node_name: "node2", WWPN: "500507680C120002", nportid: "000000", status: "inactive_unconfigured", attachment: "none", cluster_use: "unused", adapter_location: "1", adapter_port_id: "2" }
];

const calls = () => [authCall, dataCall("lsportfc", lsportfc)];

module.exports = {
    cases: [{
        name: "four fc ports",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
