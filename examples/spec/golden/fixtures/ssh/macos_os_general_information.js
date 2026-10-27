// Simulated macOS 14.5 reply. Shape follows `uname -m` followed by `system_profiler SPSoftwareDataType
// SPHardwareDataType -json`: a JSON object with "SPHardwareDataType" and "SPSoftwareDataType" arrays holding one
// item each (os_version "macOS 14.5 (23F79)", machine_model, machine_name, serial_number; Apple Silicon adds
// chip_type, Intel adds cpu_type).
const reply = require("../../replies");

const COMMAND = "uname -m && system_profiler SPSoftwareDataType SPHardwareDataType -json";

const json = (hardware, software) => JSON.stringify({ SPHardwareDataType: [hardware], SPSoftwareDataType: [software] }, null, 2)
    .replace(/": /g, '" : ');

const software = (host) => ({
    _name: "os_overview",
    boot_mode: "normal_boot",
    boot_volume: "Macintosh HD",
    kernel_version: "Darwin 23.5.0",
    local_host_name: host,
    os_version: "macOS 14.5 (23F79)",
    secure_vm: "secure_vm_disabled",
    system_integrity: "integrity_enabled",
    uptime: "up 3:11:13:42",
    user_name: "Andrea (andrea)"
});

const INTEL = "x86_64\n" + json({
    _name: "hardware_overview",
    cpu_type: "8-Core Intel Core i9",
    machine_model: "MacBookPro16,1",
    machine_name: "MacBook Pro",
    model_number: "Z0Y1000KLLL/A",
    number_processors: 8,
    packages: 1,
    physical_memory: "32 GB",
    serial_number: "C02XK1ABJGH5"
}, software("mbp-andrea")) + "\n";

const ARM = "arm64\n" + json({
    _name: "hardware_overview",
    chip_type: "Apple M2 Pro",
    machine_model: "Mac14,12",
    machine_name: "Mac mini",
    model_number: "MNH73LL/A",
    number_processors: "proc 10:6:4:0",
    physical_memory: "16 GB",
    serial_number: "F4KJ7Y2Q9M"
}, software("mac-mini")) + "\n";

const pair = (name, out) => {
    const calls = [{ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(out) }];
    return { name, entryPoints: { validate: { calls }, get_status: { calls } } };
};

module.exports = { cases: [pair("intel MacBook Pro", INTEL), pair("apple silicon Mac mini", ARM)] };
