// Simulated SonicWall TZ370W (SonicOS 7.1.1) replies. Shape follows the SonicOS 7 API: POST /api/sonicos/auth
// (basic auth, answers the { status: { success, info } } envelope and sets the session cookie) and
// GET /api/sonicos/reporting/failover-lb/status/members, read by the driver as a JSON array of members with
// group_name, member_name, link_status, lb_status, probe_status, main_target_status and alternate_target_status.
// One group with the primary WAN up and active and the backup WAN down, one group with a single member
// whose probe target is unreachable.
const reply = require("../../replies");

const AUTH = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };
const MEMBERS = [
    { group_name: "Default LB Group", member_name: "X1", link_status: "Link Up", lb_status: "Active", probe_status: "Probing", main_target_status: "Reachable", alternate_target_status: "Reachable" },
    { group_name: "Default LB Group", member_name: "X2", link_status: "No Link", lb_status: "Standby", probe_status: "Not Probing", main_target_status: "Unreachable", alternate_target_status: "Unreachable" },
    { group_name: "Branch VPN Group", member_name: "X3", link_status: "Link Up", lb_status: "Active", probe_status: "Probing", main_target_status: "Unreachable", alternate_target_status: "Reachable" }
];

const calls = [
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, AUTH) },
    { kind: "http", method: "get", target: "/api/sonicos/reporting/failover-lb/status/members", reply: reply.http(200, MEMBERS, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "two groups, one member down",
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
