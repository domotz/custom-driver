// Simulated sysstat 12.5.2 `pidstat -C "sshd|nginx"` output on Ubuntu 22.04. Shape follows pidstat(1): a banner line
// (kernel, host, date, arch, CPU count), a blank line, the column header (time, UID, PID, %usr, %system, %guest, %wait,
// %CPU, CPU, Command) and one line per matching process. `which pidstat` prints the binary path.
const reply = require("../../replies");

const PIDSTAT = [
    "Linux 5.15.0-91-generic (web01) \t03/12/2024 \t_x86_64_\t(4 CPU)",
    "",
    "10:41:07      UID       PID    %usr %system  %guest   %wait    %CPU   CPU  Command",
    "10:41:07        0       812    0.01    0.02    0.00    0.00    0.03     1  sshd",
    "10:41:07        0      1190    0.00    0.00    0.00    0.00    0.00     3  sshd",
    "10:41:07        0      1422    0.35    0.20    0.00    0.01    0.55     0  nginx",
    "10:41:07       33      1423   42.10    9.80    0.00    0.50   51.90     2  nginx",
    "10:41:07       33      1424    3.40    1.10    0.00    0.10    4.50     1  nginx",
    ""
].join("\n");

module.exports = {
    cases: [{
        name: "ubuntu 22.04",
        parameters: { processList: ["sshd", "nginx"] },
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "which pidstat", reply: reply.ssh("/usr/bin/pidstat\n") }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "pidstat -C sshd\\|nginx", reply: reply.ssh(PIDSTAT) }] }
        }
    }]
};
