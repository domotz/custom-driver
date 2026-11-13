// Simulated macOS 14.5 replies. Shape follows `system_profiler SPHardwareDataType -json` (a "SPHardwareDataType"
// array with one "hardware_overview" item; Intel Macs carry cpu_type / current_processor_speed / packages and a
// numeric number_processors, Apple Silicon Macs carry chip_type and number_processors "proc 10:6:4:0"),
// `memory_pressure` (ends with "System-wide memory free percentage: NN%") and `sysctl hw.logicalcpu vm.loadavg`
// ("hw.logicalcpu: 16", "vm.loadavg: { 2.15 2.03 1.98 }").
const reply = require("../../replies");

const hardware = (item) => JSON.stringify({ SPHardwareDataType: [item] }, null, 2).replace(/": /g, '" : ') + "\n";

const INTEL = hardware({
    _name: "hardware_overview",
    boot_rom_version: "1554.120.19.0.0 (iBridge: 22.16.13050.0.0,0)",
    cpu_type: "8-Core Intel Core i9",
    current_processor_speed: "2.3 GHz",
    l2_cache_core: "256 KB",
    l3_cache: "16 MB",
    machine_model: "MacBookPro16,1",
    machine_name: "MacBook Pro",
    model_number: "Z0Y1000KLLL/A",
    number_processors: 8,
    os_loader_version: "10151.121.1",
    packages: 1,
    physical_memory: "32 GB",
    platform_UUID: "7B1F2C34-5D6E-4F70-8A91-B2C3D4E5F607",
    serial_number: "C02XK1ABJGH5"
});

const APPLE_SILICON = hardware({
    _name: "hardware_overview",
    boot_rom_version: "10151.121.1",
    chip_type: "Apple M2 Pro",
    machine_model: "Mac14,12",
    machine_name: "Mac mini",
    model_number: "MNH73LL/A",
    number_processors: "proc 10:6:4:0",
    os_loader_version: "10151.121.1",
    physical_memory: "16 GB",
    platform_UUID: "A1B2C3D4-E5F6-4789-9ABC-DEF012345678",
    provisioning_UDID: "00006020-001A2B3C4D5E6F78",
    serial_number: "F4KJ7Y2Q9M"
});

const pressure = (bytes, free) => [
    "The system has " + bytes + " (" + bytes / 4096 + " pages with a page size of 4096).",
    "",
    "Stats: ",
    "Pages free: 61532 ",
    "Pages purgeable: 2203 ",
    "Pages purged: 118334 ",
    "",
    "Swap I/O:",
    "Swapins: 0 ",
    "Swapouts: 0 ",
    "",
    "Page Q counts:",
    "Pages active: 1650000 ",
    "Pages inactive: 1480000 ",
    "Pages speculative: 25000 ",
    "Pages throttled: 0 ",
    "Pages wired down: 450000 ",
    "",
    "Compressor Stats:",
    "Pages used by compressor: 120000 ",
    "Pages decompressed: 0 ",
    "Pages compressed: 0 ",
    "",
    "File I/O:",
    "Pageins: 811000 ",
    "Pageouts: 0 ",
    "",
    "System-wide memory free percentage: " + free + "%"
].join("\n") + "\n";

const sysctl = (cpus, load) => "hw.logicalcpu: " + cpus + "\nvm.loadavg: { " + load + " }\n";

const HW = "system_profiler SPHardwareDataType -json";
const USAGE = "memory_pressure && sysctl  hw.logicalcpu vm.loadavg";

const pair = (name, hw, bytes, free, cpus, load) => {
    const calls = [
        { kind: "ssh", method: "sendSSHCommand", target: HW, reply: reply.ssh(hw) },
        { kind: "ssh", method: "sendSSHCommand", target: USAGE, reply: reply.ssh(pressure(bytes, free) + sysctl(cpus, load)) }
    ];
    return { name, entryPoints: { validate: { calls }, get_status: { calls } } };
};

module.exports = {
    cases: [
        pair("intel MacBook Pro, 38% free memory", INTEL, 34359738368, 38, 16, "2.15 2.03 1.98"),
        // Apple Silicon: no cpu_type / current_processor_speed / packages, number_processors is a "proc P:E:..." string
        pair("apple silicon Mac mini", APPLE_SILICON, 17179869184, 62, 10, "1.20 1.35 1.40")
    ]
};
