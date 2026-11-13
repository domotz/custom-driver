// Simulated ESXi 8.0 shell output. `cut -d: -f1 /etc/passwd` prints the first field of each /etc/passwd line (the default ESXi
// accounts: root, daemon, nfsnobody, dcui, vpxuser plus a local admin), one per line, ending with a newline as cut does.
const reply = require("../../replies");

const USERS = ["root", "daemon", "nfsnobody", "dcui", "vpxuser", "svc-backup"].join("\n") + "\n";

module.exports = {
    cases: [{
        name: "esxi 8.0.0",
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "ls", reply: reply.ssh("bootbank\nbin\netc\nlib\nscratch\nvmfs\n") }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "cut -d: -f1 /etc/passwd", reply: reply.ssh(USERS) }] }
        }
    }]
};
