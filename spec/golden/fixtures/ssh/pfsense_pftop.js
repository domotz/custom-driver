// Simulated pfSense 2.6.0 `pftop -v long -w 200 -o bytes N` output (non-interactive, as the driver reads it).
// Shape follows the pftop(8) long view: a title line, the column header line, then one line per state with
// PR DIR SRC DEST [GW] STATE AGE EXP PKTS BYTES AVG RULE. GW is blank (11 tokens) unless the rule uses route-to,
// byte and average counters carry the K/M suffixes pftop prints.
const reply = require("../../replies");

const PFTOP = [
    "pfTop: Up State 1-6/6, View: long, Order: bytes, Cache: 10000",
    "PR   DIR SRC                       DEST                      GW                  STATE                  AGE       EXP    PKTS BYTES AVG RULE",
    "tcp  In  192.168.1.10:51234        93.184.216.34:443         192.168.1.1         ESTABLISHED:ESTABLISHED 00:12:03 23:59:59 9863 12M 1307 12",
    "tcp  Out 203.0.113.5:443           192.168.1.20:44812        ESTABLISHED:ESTABLISHED 00:41:10 23:59:58 5120 6M 1250 15",
    "udp  In  192.168.1.30:5353         224.0.0.251:5353          SINGLE:NO_TRAFFIC      01:02:00 00:00:21  310 98K 316 3",
    "tcp  In  192.168.1.11:60001        198.51.100.7:80           CLOSED:SYN_SENT        00:00:15 00:00:45    4 240 60 12",
    "icmp In  192.168.1.40:8            192.168.1.1:8             0:0                    00:00:09 00:00:21   18 1512 84 7",
    "udp  Out 192.168.1.1:53            192.168.1.10:41234        MULTIPLE:SINGLE        00:00:03 00:00:27    2 312 156 9"
].join("\n") + "\n";

module.exports = {
    cases: [{
        name: "pfSense 2.6.0",
        entryPoints: {
            validate: {
                calls: [{ kind: "ssh", method: "sendSSHCommand", target: "pftop -v long -w 200 -o bytes 20", reply: reply.ssh(PFTOP) }]
            },
            get_status: {
                calls: [{ kind: "ssh", method: "sendSSHCommand", target: "pftop -v long -w 200 -o bytes 50", reply: reply.ssh(PFTOP) }]
            }
        }
    }]
};
