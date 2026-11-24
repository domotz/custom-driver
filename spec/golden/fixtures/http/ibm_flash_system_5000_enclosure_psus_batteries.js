// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsenclosurebattery (-json), an array.
// Format notes: percent_charged is a bare integer string; status online/degraded; charging_status
// charged/charging/reconditioning; yes/no flags.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsenclosurebattery = [
    { enclosure_id: "1", battery_id: "1", status: "online", charging_status: "charged", recondition_needed: "no", percent_charged: "100", end_of_life_warning: "no", canister_id: "1", battery_slot: "1" },
    { enclosure_id: "1", battery_id: "2", status: "degraded", charging_status: "charging", recondition_needed: "yes", percent_charged: "42", end_of_life_warning: "yes", canister_id: "2", battery_slot: "1" }
];

const calls = () => [authCall, dataCall("lsenclosurebattery", lsenclosurebattery)];

module.exports = {
    cases: [{
        name: "two batteries",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
