// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsportusb (-json), an array.
// Format notes: status active/inactive, encryption_state enabled/unconfigured (empty when unused).
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsportusb = [
    { id: "0", node_id: "1", node_name: "node1", node_side: "left", port_id: "1", status: "active", encryption_state: "enabled", service_state: "inactive" },
    { id: "1", node_id: "1", node_name: "node1", node_side: "left", port_id: "2", status: "inactive", encryption_state: "", service_state: "inactive" },
    { id: "2", node_id: "2", node_name: "node2", node_side: "right", port_id: "1", status: "active", encryption_state: "enabled", service_state: "active" }
];

const calls = () => [authCall, dataCall("lsportusb", lsportusb)];

module.exports = {
    cases: [{
        name: "three usb ports",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
