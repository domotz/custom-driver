// Simulated iperf3 3.7 (Ubuntu 22.04) text output of `iperf3 -f m` (the driver parses the human readable report,
// not -J JSON). Shape follows the iperf3 documentation / real 3.7 runs: TCP summary lines
// "[  5]   0.00-5.00   sec   547 MBytes   918 Mbits/sec   10   sender", UDP summary with
// "Bitrate  Jitter  Lost/Total Datagrams" and the closing "iperf Done.".
const reply = require("../../replies");

const tcp = (reverse, local, bitrate, mbytes, retr) => [
    "Connecting to host ping.online.net, port 5209",
    reverse ? "Reverse mode, remote host ping.online.net is sending" : null,
    "[  5] local 192.168.1.50 port " + local + " connected to 51.158.154.152 port 5209",
    "[ ID] Interval           Transfer     Bitrate         Retr  Cwnd",
    "[  5]   0.00-1.00   sec   110 MBytes   923 Mbits/sec    2    1.32 MBytes",
    "[  5]   1.00-2.00   sec   109 MBytes   915 Mbits/sec    3    1.40 MBytes",
    "[  5]   2.00-3.00   sec   110 MBytes   921 Mbits/sec    1    1.41 MBytes",
    "[  5]   3.00-4.00   sec   109 MBytes   917 Mbits/sec    2    1.43 MBytes",
    "[  5]   4.00-5.00   sec   109 MBytes   914 Mbits/sec    2    1.45 MBytes",
    "- - - - - - - - - - - - - - - - - - - - - - - - -",
    "[ ID] Interval           Transfer     Bitrate         Retr",
    "[  5]   0.00-5.00   sec   " + mbytes + " MBytes   " + bitrate + " Mbits/sec   " + retr + "             sender",
    "[  5]   0.00-5.00   sec   " + (mbytes - 2) + " MBytes   " + (bitrate - 4) + " Mbits/sec                  receiver",
    "",
    "iperf Done."
].filter((l) => l !== null).join("\n") + "\n";

const udp = (reverse, local, bitrate) => [
    "Connecting to host ping.online.net, port 5209",
    reverse ? "Reverse mode, remote host ping.online.net is sending" : null,
    "[  5] local 192.168.1.50 port " + local + " connected to 51.158.154.152 port 5209",
    "[ ID] Interval           Transfer     Bitrate         Total Datagrams",
    "[  5]   0.00-1.00   sec   129 KBytes  1.05 Mbits/sec  91",
    "[  5]   1.00-2.00   sec   127 KBytes  1.04 Mbits/sec  90",
    "[  5]   2.00-3.00   sec   129 KBytes  1.05 Mbits/sec  91",
    "[  5]   3.00-4.00   sec   127 KBytes  1.04 Mbits/sec  90",
    "[  5]   4.00-5.00   sec   129 KBytes  1.05 Mbits/sec  91",
    "- - - - - - - - - - - - - - - - - - - - - - - - -",
    "[ ID] Interval           Transfer     Bitrate         Jitter    Lost/Total Datagrams",
    "[  5]   0.00-5.00   sec   641 KBytes  " + bitrate + " Mbits/sec  0.000 ms  0/453 (0%)  sender",
    "[  5]   0.00-5.00   sec   639 KBytes  " + (bitrate - 0.01).toFixed(2) + " Mbits/sec  0.041 ms  1/453 (0.22%)  receiver",
    "",
    "iperf Done."
].filter((l) => l !== null).join("\n") + "\n";

const ssh = (command, out) => ({ kind: "ssh", method: "sendSSHCommand", target: command, reply: reply.ssh(out) });

const which = ssh("which iperf3", "/usr/bin/iperf3\n");
const run = (host, port) => [
    ssh("iperf3 -t 5 -f m -c " + host + " -p " + port + " -R", tcp(true, 40508, 918, 547, 10)),
    ssh("iperf3 -t 5 -f m -c " + host + " -p " + port, tcp(false, 40510, 94, 56, 0)),
    ssh("iperf3 -t 5 -f m -c " + host + " -p " + port + " -u -R", udp(true, 51934, 1.05)),
    ssh("iperf3 -t 5 -f m -c " + host + " -p " + port + " -u", udp(false, 51936, 1.04))
];

module.exports = {
    cases: [{
        name: "first server with its own port",
        parameters: { targetServer: ["ping.online.net:5209", "speedtest.serverius.net:5002"], defaultIperfPort: 5201 },
        entryPoints: { validate: { calls: [which] }, get_status: { calls: run("ping.online.net", 5209) } }
    }, {
        name: "server without port uses the default",
        parameters: { targetServer: ["ping.online.net"], defaultIperfPort: 5201 },
        entryPoints: { validate: { calls: [which] }, get_status: { calls: run("ping.online.net", 5201) } }
    }]
};
