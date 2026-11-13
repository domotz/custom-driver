// Ping output of iputils on Ubuntu 20.04 (the distribution the driver was tested on): the "N packets transmitted,
// M received, X% packet loss, time Tms" statistics line and the "rtt min/avg/max/mdev = a/b/c/d ms" line, which iputils
// omits when no reply came back. `man -P cat ping` prints the manual page, any non-empty text validates.
const reply = require("../../replies");

const MAN = [
    "PING(8)                                                  iputils                                                 PING(8)",
    "",
    "NAME",
    "       ping - send ICMP ECHO_REQUEST to network hosts",
    ""
].join("\n");

const PING_OK = [
    "PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.",
    "64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=11.8 ms",
    "64 bytes from 8.8.8.8: icmp_seq=2 ttl=117 time=12.4 ms",
    "",
    "--- 8.8.8.8 ping statistics ---",
    "2 packets transmitted, 2 received, 0% packet loss, time 1002ms",
    "rtt min/avg/max/mdev = 11.801/12.100/12.400/0.300 ms",
    ""
].join("\n");

const PING_LOSS = [
    "PING 10.255.255.1 (10.255.255.1) 56(84) bytes of data.",
    "64 bytes from 10.255.255.1: icmp_seq=2 ttl=62 time=45.250 ms",
    "",
    "--- 10.255.255.1 ping statistics ---",
    "2 packets transmitted, 1 received, 50% packet loss, time 1019ms",
    "rtt min/avg/max/mdev = 45.250/45.250/45.250/0.000 ms",
    ""
].join("\n");

const PING_DOWN = [
    "PING 192.168.77.9 (192.168.77.9) 56(84) bytes of data.",
    "From 192.168.1.10 icmp_seq=1 Destination Host Unreachable",
    "From 192.168.1.10 icmp_seq=2 Destination Host Unreachable",
    "",
    "--- 192.168.77.9 ping statistics ---",
    "2 packets transmitted, 0 received, +2 errors, 100% packet loss, time 1024ms",
    "pipe 2",
    ""
].join("\n");

const ssh = (target, out) => ({ kind: "ssh", method: "sendSSHCommand", target, reply: reply.ssh(out) });

module.exports = {
    cases: [{
        name: "ubuntu 20.04",
        parameters: { ipAddressesToCheck: ["8.8.8.8", "10.255.255.1", "192.168.77.9"] },
        entryPoints: {
            validate: { calls: [ssh("man -P cat ping", MAN)] },
            get_status: {
                calls: [
                    ssh("ping -c 2 8.8.8.8", PING_OK),
                    ssh("ping -c 2 10.255.255.1", PING_LOSS),
                    ssh("ping -c 2 192.168.77.9", PING_DOWN)
                ]
            }
        }
    }]
};
