// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsmdiskgrp (-json), an array of pools.
// Format notes: capacities are strings with an automatic unit chosen by magnitude ("21.83TB",
// "512.00GB", "0.00MB"); overallocation/warning are bare percentages; status online/degraded/offline;
// a child pool names its parent.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const pool = (over) => Object.assign({
    id: "0", name: "Pool0", status: "online", mdisk_count: "2", vdisk_count: "12", capacity: "21.83TB", extent_size: "1024",
    free_capacity: "21.04TB", virtual_capacity: "812.50GB", used_capacity: "790.12GB", real_capacity: "815.00GB",
    overallocation: "3", warning: "80", easy_tier: "auto", easy_tier_status: "balanced",
    compression_active: "no", compression_virtual_capacity: "0.00MB", compression_compressed_capacity: "0.00MB",
    compression_uncompressed_capacity: "0.00MB", parent_mdisk_grp_id: "0", parent_mdisk_grp_name: "Pool0",
    child_mdisk_grp_count: "0", child_mdisk_grp_capacity: "0.00MB", type: "parent", encrypt: "yes",
    owner_type: "none", owner_id: "", owner_name: "", site_id: "", site_name: "", data_reduction: "yes",
    used_capacity_before_reduction: "1.20TB", used_capacity_after_reduction: "790.12GB", overhead_capacity: "64.00GB",
    deduplication_capacity_saving: "0.00MB", reclaimable_capacity: "12.50GB", easy_tier_fcm_over_allocation_max: "",
    provisioning_policy_id: "", provisioning_policy_name: ""
}, over);

const lsmdiskgrp = [
    pool({}),
    pool({
        id: "1", name: "Pool1", status: "degraded", mdisk_count: "1", vdisk_count: "3", capacity: "558.41GB", extent_size: "256",
        free_capacity: "100.00GB", virtual_capacity: "512.00GB", used_capacity: "300.25GB", real_capacity: "458.41GB",
        overallocation: "91", warning: "0", easy_tier: "off", easy_tier_status: "inactive", encrypt: "no", data_reduction: "no",
        used_capacity_before_reduction: "300.25GB", used_capacity_after_reduction: "300.25GB", overhead_capacity: "512.00MB",
        reclaimable_capacity: "0.00MB", parent_mdisk_grp_id: "1", parent_mdisk_grp_name: "Pool1", child_mdisk_grp_count: "1",
        child_mdisk_grp_capacity: "100.00GB"
    }),
    pool({
        id: "2", name: "Pool1_child", status: "online", mdisk_count: "0", vdisk_count: "1", capacity: "100.00GB",
        free_capacity: "60.00GB", virtual_capacity: "40.00GB", used_capacity: "40.00GB", real_capacity: "40.00GB", overallocation: "40",
        parent_mdisk_grp_id: "1", parent_mdisk_grp_name: "Pool1", type: "child_thick", used_capacity_before_reduction: "0.00MB",
        used_capacity_after_reduction: "0.00MB", overhead_capacity: "0.00MB"
    })
];

const calls = () => [authCall, dataCall("lsmdiskgrp", lsmdiskgrp)];

module.exports = {
    cases: [{
        name: "parent, degraded and child pools",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
