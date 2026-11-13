// Simulated ESXi 8.0 /etc/ntp.conf as written by the host's NTP configuration (default restrict lines, the configured servers and
// the drift file), printed by `cat /etc/ntp.conf`.
const reply = require("../../replies");

const NTP_CONF = [
    "tos maxdist 15",
    "server 0.pool.ntp.org",
    "server 1.pool.ntp.org",
    "restrict default kod nomodify notrap nopeer noquery",
    "restrict -6 default kod nomodify notrap nopeer noquery",
    "restrict 127.0.0.1",
    "restrict -6 ::1",
    "driftfile /etc/ntp.drift",
    ""
].join("\n");

module.exports = {
    cases: [{
        name: "esxi 8.0.0",
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "ls", reply: reply.ssh("bootbank\nbin\netc\nlib\nscratch\nvmfs\n") }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "cat /etc/ntp.conf", reply: reply.ssh(NTP_CONF) }] }
        }
    }]
};
