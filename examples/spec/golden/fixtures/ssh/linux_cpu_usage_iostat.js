// Simulated Ubuntu 22.04 (sysstat 12.5) replies. Shape follows `iostat -c 5 60` redirected to a file: one
// "Linux ..." banner, then a blank line and an "avg-cpu:" header plus a values line per 5 s sample
// (%user %nice %system %iowait %steal %idle). The driver reads that file with cat, truncates it, then checks
// that iostat exists and restarts the background collector (which just prints "done").
const reply = require("../../replies");

const IOSTAT = [
    "Linux 5.15.0-91-generic (web01) \t10/27/2026 \t_x86_64_\t(4 CPU)",
    "",
    "avg-cpu:  %user   %nice %system %iowait  %steal   %idle",
    "           4.12    0.00    1.88    0.25    0.50   93.25",
    "",
    "avg-cpu:  %user   %nice %system %iowait  %steal   %idle",
    "          10.30    0.00    3.10    1.20    0.00   85.40",
    "",
    "avg-cpu:  %user   %nice %system %iowait  %steal   %idle",
    "           7.00    0.50    2.00    0.00    1.00   89.50",
    ""
].join("\n");

const WHICH = [{ kind: "ssh", method: "sendSSHCommand", target: "which iostat", reply: reply.ssh("/usr/bin/iostat\n") }];

module.exports = {
    cases: [{
        name: "ubuntu 22.04",
        entryPoints: {
            validate: { calls: WHICH },
            get_status: {
                calls: [
                    { kind: "ssh", method: "sendSSHCommand", target: "cat /tmp/domotz_iostat_cpus.output", reply: reply.ssh(IOSTAT) },
                    { kind: "ssh", method: "sendSSHCommand", target: "truncate -s 0 /tmp/domotz_iostat_cpus.output", reply: reply.ssh("") },
                    ...WHICH,
                    { kind: "ssh", method: "sendSSHCommand", target: "nohup iostat -c 5 60 > /tmp/domotz_iostat_cpus.output & echo done", reply: reply.ssh("done\n") }
                ]
            }
        }
    }]
};
