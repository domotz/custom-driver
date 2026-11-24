// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsenclosurecanister (-json), an array.
// Format notes: one row per canister; status online/offline/degraded; node_id/node_name empty for a
// canister that is not a node (expansion canister).
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsenclosurecanister = [
    { enclosure_id: "1", canister_id: "1", status: "online", type: "node", node_id: "1", node_name: "node1" },
    { enclosure_id: "1", canister_id: "2", status: "degraded", type: "node", node_id: "2", node_name: "node2" },
    { enclosure_id: "2", canister_id: "1", status: "online", type: "expansion", node_id: "", node_name: "" },
    { enclosure_id: "2", canister_id: "2", status: "offline", type: "expansion", node_id: "", node_name: "" }
];

const calls = () => [authCall, dataCall("lsenclosurecanister", lsenclosurecanister)];

module.exports = {
    cases: [{
        name: "control and expansion",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
