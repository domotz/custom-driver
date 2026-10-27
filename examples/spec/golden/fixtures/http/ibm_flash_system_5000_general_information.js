// Simulated FlashSystem 5000 (8.5.0.6) replies. Shape follows the Storage Virtualize REST API: POST
// /rest/auth returns { token }, every other POST /rest/<command> returns the CLI command's -json output
// (one object for lssystem and lssra). Capacities are strings with an automatic unit suffix, as the CLI
// prints them (svc_lssystem docs: "0.00MB"), so a small value is in GB, not TB.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const lssystem = {
    id: "0000020420E0C9F2",
    name: "FS5000-PROD",
    location: "local",
    total_mdisk_capacity: "21.83TB",
    space_in_mdisk_grps: "21.83TB",
    space_allocated_to_vdisks: "812.50GB",
    total_free_space: "21.04TB",
    total_vdiskcopy_capacity: "5.00TB",
    total_used_capacity: "790.12GB",
    total_overallocation: "22",
    total_vdisk_capacity: "5.00TB",
    total_allocated_extent_capacity: "815.00GB",
    statistics_status: "on",
    statistics_frequency: "15",
    email_state: "running",
    code_level: "8.5.0.6 (build 157.12.2209091428000)",
    product_name: "IBM FlashSystem 5000",
    total_drive_raw_capacity: "26.19TB",
    topology: "standard",
    topology_status: "",
    physical_capacity: "21.83TB",
    physical_free_capacity: "21.04TB"
};

const lssra = {
    status: "disabled",
    connected: "no",
    remote_support_enabled: "yes",
    remote_support_status: "active",
    active_monitor_user_count: "1"
};

function calls() {
    return [
        { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) },
        { kind: "http", method: "post", target: "/rest/lssystem", headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, lssystem) },
        { kind: "http", method: "post", target: "/rest/lssra", headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, lssra) }
    ];
}

module.exports = {
    cases: [{
        name: "fs5000 8.5.0.6",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
