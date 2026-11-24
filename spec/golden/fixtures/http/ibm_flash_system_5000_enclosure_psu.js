// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsenclosurepsu (-json), an array.
// Format notes: PSU_id (capital PSU), status online/offline/degraded, input_power ac/none.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsenclosurepsu = [
    { enclosure_id: "1", PSU_id: "1", status: "online", input_power: "ac" },
    { enclosure_id: "1", PSU_id: "2", status: "offline", input_power: "none" },
    { enclosure_id: "2", PSU_id: "1", status: "online", input_power: "ac" },
    { enclosure_id: "2", PSU_id: "2", status: "degraded", input_power: "ac" }
];

const calls = () => [authCall, dataCall("lsenclosurepsu", lsenclosurepsu)];

module.exports = {
    cases: [{
        name: "four psus",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
