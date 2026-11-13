// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsportsas (-json), an array.
// Format notes: port_speed is "12Gb" (value + unit) or "N/A"; status online/offline/degraded;
// attachment host/controller/none; switch_WWPN is all zeros when there is no switch.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsportsas = [
    { id: "0", port_id: "1", port_speed: "12Gb", node_id: "1", node_name: "node1", WWPN: "500507680C110001", status: "online", switch_WWPN: "0000000000000000", attachment: "controller", type: "sas", adapter_location: "0", adapter_port_id: "1" },
    { id: "1", port_id: "2", port_speed: "6Gb", node_id: "1", node_name: "node1", WWPN: "500507680C110002", status: "degraded", switch_WWPN: "0000000000000000", attachment: "host", type: "sas", adapter_location: "0", adapter_port_id: "2" },
    { id: "2", port_id: "1", port_speed: "N/A", node_id: "2", node_name: "node2", WWPN: "500507680C120001", status: "offline", switch_WWPN: "0000000000000000", attachment: "none", type: "sas", adapter_location: "0", adapter_port_id: "1" }
];

const calls = () => [authCall, dataCall("lsportsas", lsportsas)];

module.exports = {
    cases: [{
        name: "three sas ports",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
