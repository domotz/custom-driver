// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lscloudcallhome (-json), a single object.
// Format notes: timestamps are the CLI's YYMMDDHHMMSS (e.g. "261024083015"), empty string when the
// event never happened. Two cases: healthy connection, and a failing one.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const healthy = {
    status: "enabled",
    connection: "active",
    error_sequence_number: "",
    last_success: "261024083015",
    last_failure: ""
};

const failing = {
    status: "enabled",
    connection: "error",
    error_sequence_number: "100",
    last_success: "260930215900",
    last_failure: "261024120545"
};

const calls = (body) => () => [authCall, dataCall("lscloudcallhome", body)];

module.exports = {
    cases: [
        { name: "connection active", entryPoints: { validate: { calls: calls(healthy)() }, get_status: { calls: calls(healthy)() } } },
        { name: "connection error", entryPoints: { validate: { calls: calls(failing)() }, get_status: { calls: calls(failing)() } } }
    ]
};
