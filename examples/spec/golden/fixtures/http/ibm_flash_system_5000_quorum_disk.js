// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsquorum (-json), an array of the three quorum
// candidates. Format notes: quorum_index 0-2, status online/offline, active yes/no, object_type
// drive/mdisk, override yes/no, site_id/site_name empty on a standard topology.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsquorum = [
    { quorum_index: "0", status: "online", id: "4", name: "drive4", controller_id: "", controller_name: "", active: "yes", object_type: "drive", override: "no", site_id: "", site_name: "" },
    { quorum_index: "1", status: "online", id: "7", name: "drive7", controller_id: "", controller_name: "", active: "no", object_type: "drive", override: "no", site_id: "", site_name: "" },
    { quorum_index: "2", status: "offline", id: "", name: "", controller_id: "", controller_name: "", active: "no", object_type: "device", override: "no", site_id: "", site_name: "" }
];

const calls = () => [authCall, dataCall("lsquorum", lsquorum)];

module.exports = {
    cases: [{
        name: "two drives and one missing",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
