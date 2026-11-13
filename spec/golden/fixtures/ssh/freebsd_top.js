// Simulated FreeBSD 12.3 `top -o cpu| head -n19` output (batch mode). Shape follows top(1) on a ZFS system: summary lines
// "last pid / load averages / up", "N processes: x running, y sleeping", "CPU:", "Mem:", "ARC:" with its "Compressed"
// continuation line, "Swap:", a blank line, the column header and the process lines (PID USERNAME THR PRI NICE SIZE RES
// STATE C TIME WCPU COMMAND); head -n19 keeps the 9 header lines and 10 processes. System processes (idle, kernel threads) are hidden, as top does without -S.
const reply = require("../../replies");

const TOP = [
    "last pid: 41208;  load averages:  1.52,  0.98,  0.61  up 12+03:21:45    14:32:10",
    "58 processes:  3 running, 55 sleeping",
    "CPU: 12.5% user,  0.0% nice,  4.2% system,  0.3% interrupt, 83.0% idle",
    "Mem: 450M Active, 1200M Inact, 2100M Wired, 3500M Free",
    "ARC: 1500M Total, 800M MFU, 600M MRU, 4M Anon, 20M Header, 76M Other",
    "     1200M Compressed, 3100M Uncompressed, 2.58:1 Ratio",
    "Swap: 2048M Total, 2000M Free",
    "",
    "  PID USERNAME    THR PRI NICE   SIZE    RES STATE    C   TIME    WCPU COMMAND",
    "41200 www           4  52    0   512M   180M CPU1     1   3:45  95.12% php-fpm",
    "  912 mysql        28  20    0  1024M   640M select   0  41:09  12.30% mysqld",
    "41190 root          1  20    0    14M  3600K CPU2     2   0:12   4.55% top",
    "  655 root          1  20    0    22M  8400K select   3   9:50   0.98% sshd",
    "  701 unbound       2  20    0    48M    30M kqread   1   5:02   0.20% unbound",
    "  733 ntpd          1  20    0    24M  5200K select   0   0:31   0.05% ntpd",
    "  480 root          1  52    0    12M  2800K select   2   0:02   0.00% devd",
    "  541 root          1  20    0    12M  2500K select   3   0:07   0.00% syslogd",
    "  798 root          1  20    0    13M  2900K nanslp   1   0:11   0.00% cron",
    "  622 root          1  20    0    16M  4100K select   2   1:15   0.00% moused",
    ""
].join("\n");

const CMD = "top -o cpu| head -n19";
const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: CMD, reply: reply.ssh(TOP) });

module.exports = {
    cases: [{
        name: "freebsd 12.3",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
