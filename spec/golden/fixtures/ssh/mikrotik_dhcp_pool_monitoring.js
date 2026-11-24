// Simulated MikroTik RouterOS 7.13.3 replies. Shape follows the RouterOS 7 terminal output of `/ip/pool/print
// without-paging` (a "Columns: NAME, RANGES, NEXT-POOL" line, a "# NAME RANGES NEXT-POOL" header, one numbered row
// per pool) and `/ip/pool/used/print without-paging` (a "Columns: POOL, ADDRESS, OWNER, INFO" line, a header, one
// unnumbered row per leased address). RouterOS terminates lines with \r\n.
const reply = require("../../replies");

const POOLS = [
    "Columns: NAME, RANGES, NEXT-POOL",
    "# NAME         RANGES                        NEXT-POOL",
    "0 dhcp_pool0   192.168.88.10-192.168.88.254  none",
    "1 guest_pool   192.168.20.10-192.168.20.50   none",
    "2 iot_pool     10.10.10.2-10.10.10.5         none",
    ""
].join("\r\n");

const USED = [
    "Columns: POOL, ADDRESS, OWNER, INFO",
    "POOL        ADDRESS        OWNER              INFO",
    "dhcp_pool0  192.168.88.254 AA:BB:CC:11:22:33  dhcp1",
    "dhcp_pool0  192.168.88.253 AA:BB:CC:11:22:34  dhcp1",
    "dhcp_pool0  192.168.88.252 AA:BB:CC:11:22:35  dhcp1",
    "guest_pool  192.168.20.50  DC:A6:32:00:11:22  dhcp-guest",
    "iot_pool    10.10.10.5     B8:27:EB:00:00:01  dhcp-iot",
    "iot_pool    10.10.10.4     B8:27:EB:00:00:02  dhcp-iot",
    "iot_pool    10.10.10.3     B8:27:EB:00:00:03  dhcp-iot",
    "iot_pool    10.10.10.2     B8:27:EB:00:00:04  dhcp-iot",
    ""
].join("\r\n");

function calls() {
    return [
        { kind: "ssh", method: "sendSSHCommand", target: "/ip/pool/print without-paging", reply: reply.ssh(POOLS) },
        { kind: "ssh", method: "sendSSHCommand", target: "/ip/pool/used/print without-paging", reply: reply.ssh(USED) }
    ];
}

module.exports = {
    cases: [{
        name: "routeros 7.13.3, one pool exhausted",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
