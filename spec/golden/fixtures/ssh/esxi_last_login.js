// Simulated ESXi 8.0 /var/log/auth.log line (ISO timestamp, sshd[pid]: message). The driver's pipeline
// `grep -i -e login -e accepted ... | tail -n2 | head -n1` prints one line: the second to last match.
const reply = require("../../replies");

const LINE = "2026-10-27T07:58:12.331Z sshd[2108543]: Accepted keyboard-interactive/pam for root from 192.168.1.20 port 51522 ssh2\n";

module.exports = {
    cases: [{
        name: "esxi 8.0.0",
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "ls", reply: reply.ssh("bootbank\nbin\netc\nlib\nscratch\nvmfs\n") }] },
            get_status: {
                calls: [{
                    kind: "ssh", method: "sendSSHCommand",
                    target: "grep -i -e login -e accepted /var/log/auth.log | grep -v \"grep\" | tail -n2 | head -n1",
                    reply: reply.ssh(LINE)
                }]
            }
        }
    }]
};
