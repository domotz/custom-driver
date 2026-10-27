// Simulated FlashSystem 5000 (8.5.0.6) replies. Commands: lsmdisk (-json, an array of every MDisk) and
// lsarray (-json, an array with one row per RAID array, keyed by mdisk_id). The driver joins them.
// Format notes: capacity is a string with an automatic unit ("21.83TB", "558.41GB"); mode is
// array/managed/unmanaged; status online/degraded/offline; unmanaged MDisks have no array row.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsmdisk = [
    { id: "0", name: "mdisk0", status: "online", mode: "array", mdisk_grp_id: "0", mdisk_grp_name: "Pool0", capacity: "21.83TB", "ctrl_LUN_#": "", controller_name: "", UID: "", tier: "tier1_flash", encrypt: "yes", site_id: "", site_name: "", distributed: "yes", dedupe: "no", over_provisioned: "yes", supports_unmap: "yes" },
    { id: "1", name: "mdisk1", status: "degraded", mode: "array", mdisk_grp_id: "1", mdisk_grp_name: "Pool1", capacity: "558.41GB", "ctrl_LUN_#": "", controller_name: "", UID: "", tier: "tier0_flash", encrypt: "no", site_id: "", site_name: "", distributed: "no", dedupe: "no", over_provisioned: "no", supports_unmap: "no" },
    { id: "2", name: "mdisk2", status: "online", mode: "unmanaged", mdisk_grp_id: "", mdisk_grp_name: "", capacity: "1.09TB", "ctrl_LUN_#": "0000000000000001", controller_name: "controller0", UID: "6005076801234567890000000000001a", tier: "tier_enterprise", encrypt: "no", site_id: "", site_name: "", distributed: "", dedupe: "", over_provisioned: "", supports_unmap: "" }
];

const lsarray = [
    { mdisk_id: "0", mdisk_name: "mdisk0", status: "online", mdisk_grp_id: "0", mdisk_grp_name: "Pool0", capacity: "21.83TB", raid_status: "online", raid_level: "raid6", redundancy: "2", strip_size: "256", tier: "tier1_flash", encrypt: "yes" },
    { mdisk_id: "1", mdisk_name: "mdisk1", status: "degraded", mdisk_grp_id: "1", mdisk_grp_name: "Pool1", capacity: "558.41GB", raid_status: "degraded", raid_level: "raid1", redundancy: "0", strip_size: "256", tier: "tier0_flash", encrypt: "no" }
];

const calls = () => [authCall, dataCall("lsmdisk", lsmdisk), dataCall("lsarray", lsarray)];

module.exports = {
    cases: [{
        name: "two arrays and one unmanaged",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
