// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsupdate (-json), a single object.
// Format notes: timestamps are the CLI's YYMMDDHHMMSS, empty string when unset; progress is a bare
// percentage; status idle when nothing is running. Two cases: idle system and an update in progress.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const idle = {
    status: "idle",
    event_sequence_number: "",
    progress: "",
    estimated_completion_time: "",
    suggested_action: "",
    system_new_code_level: "",
    system_forced: "",
    system_next_node_status: "none",
    system_next_node_time: "",
    system_next_node_id: "",
    system_next_node_name: "",
    system_next_pause_time: ""
};

const updating = {
    status: "system_updating",
    event_sequence_number: "",
    progress: "45",
    estimated_completion_time: "261027143000",
    suggested_action: "wait",
    system_new_code_level: "8.5.0.8 (build 157.20.2301101200000)",
    system_forced: "no",
    system_next_node_status: "pending",
    system_next_node_time: "261027140500",
    system_next_node_id: "2",
    system_next_node_name: "node2",
    system_next_pause_time: "261027150000"
};

const calls = (body) => [authCall, dataCall("lsupdate", body)];

module.exports = {
    cases: [
        { name: "idle", entryPoints: { validate: { calls: calls(idle) }, get_status: { calls: calls(idle) } } },
        { name: "updating", entryPoints: { validate: { calls: calls(updating) }, get_status: { calls: calls(updating) } } }
    ]
};
