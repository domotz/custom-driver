// Simulated FreeBSD 12.3 `netstat -4 -r -n | tail -n +5` / `netstat -6 -r -n | tail -n +5` output. Shape follows
// netstat(1): "Routing tables", a blank line, the "Internet:" / "Internet6:" title and the Destination / Gateway / Flags /
// Netif / Expire header; tail -n +5 therefore starts on the first route.
const reply = require("../../replies");

const V4 = [
    "default            192.168.1.1        UGS         em0",
    "127.0.0.1          link#2             UH          lo0",
    "192.168.1.0/24     link#1             U           em0",
    "192.168.1.20       link#1             UHS         lo0",
    "10.8.0.0/24        10.8.0.2           UGS        tun0",
    ""
].join("\n");

const V6 = [
    "::/96                             ::1                           URS         lo0",
    "::1                               link#2                        UHS         lo0",
    "fe80::%lo0/64                     link#2                        U           lo0",
    "fe80::%em0/64                     link#1                        U           em0",
    "ff02::/16                         ::1                           URS         lo0",
    ""
].join("\n");

const ssh = (target, out) => ({ kind: "ssh", method: "sendSSHCommand", target, reply: reply.ssh(out) });

module.exports = {
    cases: [{
        name: "freebsd 12.3",
        entryPoints: {
            validate: { calls: [ssh("netstat -r -n", "Routing tables\n\nInternet:\n" + V4)] },
            get_status: {
                calls: [
                    ssh("netstat -4 -r -n | tail -n +5", V4),
                    ssh("netstat -6 -r -n | tail -n +5", V6)
                ]
            }
        }
    }]
};
