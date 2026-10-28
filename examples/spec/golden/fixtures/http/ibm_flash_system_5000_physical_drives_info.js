// Simulated FlashSystem 5000 (8.5.0.6) replies. Commands: lsdrive (-json, an array, one row per
// drive, keyed by id) and lsarraymember (-json, an array, one row per array member with mdisk_id,
// member_id, drive_id, spare_protection, balanced). The driver joins lsdrive.id with
// lsarraymember.drive_id.
// Format notes: capacity is a string with an automatic unit ("1.09TB", "558.41GB"); status
// online/offline/degraded; use member/spare/candidate/failed; member_id is the drive's index inside
// its array (0-based, per mdisk), not a global id; candidate drives have empty mdisk/member fields.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const drive = (over) => Object.assign({
    id: "0", status: "online", error_sequence_number: "", use: "member", tech_type: "tier1_flash", capacity: "1.09TB",
    mdisk_id: "0", mdisk_name: "mdisk0", member_id: "0", enclosure_id: "1", slot_id: "1", node_id: "", node_name: "",
    auto_manage: "inactive", drive_class_id: "0", slow_write_count: "0", slow_write_time_last: ""
}, over);

const lsdrive = [
    drive({}),
    drive({ id: "1", member_id: "1", slot_id: "2" }),
    drive({ id: "2", status: "degraded", error_sequence_number: "1010", tech_type: "tier0_flash", capacity: "558.41GB", mdisk_id: "1", mdisk_name: "mdisk1", member_id: "0", slot_id: "3", slow_write_count: "7", slow_write_time_last: "261024101500" }),
    drive({ id: "3", status: "online", use: "candidate", capacity: "558.41GB", mdisk_id: "", mdisk_name: "", member_id: "", slot_id: "4" })
];

const lsarraymember = [
    { mdisk_id: "0", member_id: "0", drive_id: "0", new_drive_id: "", spare_protection: "1", balanced: "yes" },
    { mdisk_id: "0", member_id: "1", drive_id: "1", new_drive_id: "", spare_protection: "1", balanced: "yes" },
    { mdisk_id: "1", member_id: "0", drive_id: "2", new_drive_id: "3", spare_protection: "0", balanced: "no" }
];

const calls = () => [authCall, dataCall("lsdrive", lsdrive), dataCall("lsarraymember", lsarraymember)];

module.exports = {
    cases: [{
        name: "four drives in two arrays",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
