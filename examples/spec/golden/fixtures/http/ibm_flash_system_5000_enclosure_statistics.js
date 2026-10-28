// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsenclosurestats (-json), an array.
// Format notes: stat_current/stat_peak are plain numbers as strings, stat_peak_time is YYMMDDHHMMSS.
// Stats: power_w (watts) and temp_c (Celsius), per enclosure.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsenclosurestats = [
    { enclosure_id: "1", stat_id: "power_w", stat_name: "power_w", stat_current: "255", stat_peak: "270", stat_peak_time: "261026101530" },
    { enclosure_id: "1", stat_id: "temp_c", stat_name: "temp_c", stat_current: "23", stat_peak: "31", stat_peak_time: "261024184500" },
    { enclosure_id: "2", stat_id: "power_w", stat_name: "power_w", stat_current: "0", stat_peak: "148", stat_peak_time: "261020090000" },
    { enclosure_id: "2", stat_id: "temp_c", stat_name: "temp_c", stat_current: "24.5", stat_peak: "29.5", stat_peak_time: "261024184500" }
];

const calls = () => [authCall, dataCall("lsenclosurestats", lsenclosurestats)];

module.exports = {
    cases: [{
        name: "two enclosures",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
