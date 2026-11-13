// Simulated Proxmox VE 8.0.3 replies. `pveversion` prints "pve-manager/<ver>/<commit> (running kernel: <k>)"
// and `pveperf` prints the "KEY: value unit" lines documented in the pveperf man page (CPU BOGOMIPS,
// REGEX/SECOND, HD SIZE, BUFFERED READS, AVERAGE SEEK TIME, FSYNCS/SECOND, DNS EXT, DNS INT).
const reply = require("../../replies");

const PVEVERSION = "pve-manager/8.0.3/bbf3993334bfa916 (running kernel: 6.2.16-3-pve)\n";
const PVEPERF = [
    "CPU BOGOMIPS:      38400.00",
    "REGEX/SECOND:      1485469",
    "HD SIZE:           93.93 GB (/dev/mapper/pve-root)",
    "BUFFERED READS:    134.54 MB/sec",
    "AVERAGE SEEK TIME: 0.15 ms",
    "FSYNCS/SECOND:     2159.41",
    "DNS EXT:           24.62 ms",
    "DNS INT:           1.04 ms (lan.example)",
    ""
].join("\n");

const calls = () => [
    { kind: "ssh", method: "sendSSHCommand", target: "pveversion", reply: reply.ssh(PVEVERSION) },
    { kind: "ssh", method: "sendSSHCommand", target: "pveperf", reply: reply.ssh(PVEPERF) }
];

module.exports = {
    cases: [{
        name: "proxmox 8.0.3",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
