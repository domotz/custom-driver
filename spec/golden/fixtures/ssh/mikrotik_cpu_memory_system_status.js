// Simulated MikroTik RouterOS 7.11 replies. Shape follows the documented `/system resource print` output
// (https://help.mikrotik.com/docs/display/ROS/Resource): right-aligned "key: value" lines, CRLF line ends, memory and
// disk sizes in KiB/MiB/GiB with one decimal (RouterOS 7 switches to GiB above 1 GiB), uptime as "2w3d4h5m6s".
const reply = require("../../replies");

const COMMAND = "system resource print";

function resource(values) {
    return Object.keys(values).map((k) => (k + ": " + values[k]).padStart(34)).join("\r\n") + "\r\n";
}

const CCR2004 = resource({
    "uptime": "2w3d4h5m6s",
    "version": "7.11.2 (stable)",
    "build-time": "Oct/12/2023 10:34:03",
    "factory-software": "7.6",
    "free-memory": "3584.5MiB",
    "total-memory": "4096.0MiB",
    "cpu": "ARM64",
    "cpu-count": "4",
    "cpu-frequency": "1700MHz",
    "cpu-load": "7%",
    "free-hdd-space": "98.4MiB",
    "total-hdd-space": "128.0MiB",
    "write-sect-since-reboot": "81224",
    "write-sect-total": "5214790",
    "bad-blocks": "0%",
    "architecture-name": "arm64",
    "board-name": "CCR2004-1G-12S+2XS",
    "platform": "MikroTik"
});

const CCR2116 = resource({
    "uptime": "5d12h30m",
    "version": "7.14.1 (stable)",
    "build-time": "Feb/07/2024 09:02:15",
    "factory-software": "7.1",
    "free-memory": "896.5MiB",
    "total-memory": "4.0GiB",
    "cpu": "ARM64",
    "cpu-count": "16",
    "cpu-frequency": "2000MHz",
    "cpu-load": "21%",
    "free-hdd-space": "1.2GiB",
    "total-hdd-space": "1.5GiB",
    "architecture-name": "arm64",
    "board-name": "CCR2116-12G-4S+",
    "platform": "MikroTik"
});

function ep(output) {
    const calls = [{ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(output) }];
    return { validate: { calls }, get_status: { calls } };
}

module.exports = {
    cases: [
        { name: "ccr2004, sizes in MiB", entryPoints: ep(CCR2004) },
        { name: "ccr2116, sizes in GiB", entryPoints: ep(CCR2116) }
    ]
};
