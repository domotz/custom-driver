// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsdnsserver (-json), an array.
// Format notes: fields id, name, type (ipv4/ipv6), IP_address, status as the CLI prints them.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsdnsserver = [
    { id: "0", name: "dns0", type: "ipv4", IP_address: "10.10.0.53", status: "active" },
    { id: "1", name: "dns1", type: "ipv4", IP_address: "10.10.0.54", status: "inactive" },
    { id: "2", name: "dns2", type: "ipv6", IP_address: "2001:db8:10::53", status: "active" }
];

const calls = () => [authCall, dataCall("lsdnsserver", lsdnsserver)];

module.exports = {
    cases: [{
        name: "three servers",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
