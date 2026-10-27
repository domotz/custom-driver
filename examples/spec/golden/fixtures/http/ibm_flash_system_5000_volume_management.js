// Simulated FlashSystem 5000 (8.5.0.6) replies. Commands: lsvdisk (-json, an array, keyed by id),
// lsvdiskanalysis (-json, an array keyed by id, only for analysed volumes) and lsvdiskcopy (-json, an
// array keyed by vdisk_id, one row per copy). The driver joins the three.
// Format notes: capacities are strings with an automatic unit ("2.00TB", "100.00GB", "512.00MB"),
// ratios are bare percentages, analysis_time is YYMMDDHHMMSS; status online/offline/degraded.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const vdisk = (over) => Object.assign({
    id: "0", name: "vol0", IO_group_id: "0", IO_group_name: "io_grp0", status: "online", mdisk_grp_id: "0", mdisk_grp_name: "Pool0",
    capacity: "2.00TB", type: "striped", FC_id: "", FC_name: "", RC_id: "", RC_name: "", vdisk_UID: "600507680C80000000000000000000A0",
    fc_map_count: "0", copy_count: "1", fast_write_state: "empty", se_copy_count: "1", RC_change: "no", compressed_copy_count: "0",
    parent_mdisk_grp_id: "0", parent_mdisk_grp_name: "Pool0", formatting: "no", encrypt: "yes"
}, over);

const lsvdisk = [
    vdisk({}),
    vdisk({ id: "1", name: "vol1", capacity: "100.00GB", vdisk_UID: "600507680C80000000000000000000A1", fc_map_count: "1", se_copy_count: "0", fast_write_state: "not_empty" }),
    vdisk({ id: "2", name: "vol2", status: "offline", mdisk_grp_id: "1", mdisk_grp_name: "Pool1", parent_mdisk_grp_id: "1", parent_mdisk_grp_name: "Pool1", capacity: "512.00MB", vdisk_UID: "600507680C80000000000000000000A2", encrypt: "no", formatting: "yes" })
];

const lsvdiskanalysis = [
    { id: "0", name: "vol0", capacity: "2.00TB", thin_size: "1.50TB", thin_savings: "512.00GB", thin_savings_ratio: "25.00", compressed_size: "1.20TB", compression_savings: "300.00GB", compression_savings_ratio: "19.53", total_savings: "812.00GB", total_savings_ratio: "39.65", margin_of_error: "5.00", analysis_time: "261025030000" },
    { id: "1", name: "vol1", capacity: "100.00GB", thin_size: "60.00GB", thin_savings: "40.00GB", thin_savings_ratio: "40.00", compressed_size: "0.00MB", compression_savings: "0.00MB", compression_savings_ratio: "0.00", total_savings: "40.00GB", total_savings_ratio: "40.00", margin_of_error: "5.00", analysis_time: "261025030500" }
];

const copy = (over) => Object.assign({
    vdisk_id: "0", vdisk_name: "vol0", copy_id: "0", status: "online", sync: "yes", primary: "yes", mdisk_grp_id: "0", mdisk_grp_name: "Pool0",
    capacity: "2.00TB", type: "striped", se_copy: "yes", easy_tier: "on", easy_tier_status: "balanced", compressed_copy: "no", encrypt: "yes", deduplicated_copy: "no"
}, over);

const lsvdiskcopy = [
    copy({}),
    copy({ vdisk_id: "1", vdisk_name: "vol1", capacity: "100.00GB", se_copy: "no", easy_tier_status: "active" }),
    copy({ vdisk_id: "2", vdisk_name: "vol2", status: "offline", sync: "no", mdisk_grp_id: "1", mdisk_grp_name: "Pool1", capacity: "512.00MB", se_copy: "no", easy_tier: "off", easy_tier_status: "inactive", encrypt: "no" })
];

const calls = () => [authCall, dataCall("lsvdisk", lsvdisk), dataCall("lsvdiskanalysis", lsvdiskanalysis), dataCall("lsvdiskcopy", lsvdiskcopy)];

module.exports = {
    cases: [{
        name: "three volumes",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
