// Simulated pfSense 2.6.0 replies. Shape follows the MIBs bsnmpd (bsnmpd-modules-pf, BEGEMOT-PF-MIB, enterprise
// 12325.1.200) and net-snmp's UCD-SNMP-MIB / HOST-RESOURCES-MIB / IF-MIB serve on pfSense:
//  - BEGEMOT-PF-MIB pfStatus (.1.1), pfCounter (.1.2), pfStateTable (.1.3), pfSrcNodes (.1.4), pfLimits (.1.5), and the
//    pfInterfaces table (.1.8.2.1: column 2 = descr, 6 = rules refs, 7..10 = IPv4 bytes in pass/in block/out pass/out
//    block, 11..14 = IPv4 packets, 15..18 = IPv6 bytes, 19..22 = IPv6 packets), indexed by pf's own row number (lo0 is
//    row 1, em0 row 2, em1 row 3), which is not the ifIndex;
//  - IF-MIB ifTable / ifXTable for em0 (ifIndex 1) and em1 (ifIndex 2), ifHCInOctets/ifHCOutOctets, ifHighSpeed in Mbps;
//  - UCD-SNMP-MIB ssCpu* (.11), memory (.4), laTable (.10.1; laNames "Load-1", "Load-5", "Load-15");
//  - HOST-RESOURCES-MIB hrProcessorLoad (one row per core), hrSWRunName / hrSWRunStatus (1 = running), hrSystemUptime.
// Over SSH (sendSSHCommand, trimmed): `ps aux | grep <service> | grep -v grep` for each service (empty when it is not
// running) and the dig loop that prints "<nameserver>:<dig exit status>" per nameserver (9 = no reply).
// em1 is administratively down; openvpn is not running; the second nameserver does not answer.
const reply = require("../../replies");

const PF = "1.3.6.1.4.1.12325.1.200.1.8.2.1";
const PF_ROW = { lo0: 1, em0: 2, em1: 3 };
const HR_RUN = "1.3.6.1.2.1.25.4.2.1";
const LA = "1.3.6.1.4.1.2021.10.1";
const CPU = "1.3.6.1.2.1.25.3.3.1.2";

const mib = {};
// scalars
Object.assign(mib, {
    "1.3.6.1.4.1.12325.1.200.1.1.1.0": "1", // pfStatusRunning
    "1.3.6.1.4.1.12325.1.200.1.2.1.0": "9812345", // match
    "1.3.6.1.4.1.12325.1.200.1.2.2.0": "3", // bad-offset
    "1.3.6.1.4.1.12325.1.200.1.2.3.0": "21", // fragment
    "1.3.6.1.4.1.12325.1.200.1.2.4.0": "5", // short
    "1.3.6.1.4.1.12325.1.200.1.2.5.0": "42", // normalize
    "1.3.6.1.4.1.12325.1.200.1.2.6.0": "0", // memory
    "1.3.6.1.4.1.12325.1.200.1.3.1.0": "1234", // states current
    "1.3.6.1.4.1.12325.1.200.1.4.1.0": "7", // src nodes current
    "1.3.6.1.4.1.12325.1.200.1.5.1.0": "100000", // states limit
    "1.3.6.1.4.1.12325.1.200.1.5.2.0": "10000", // src nodes limit
    "1.3.6.1.4.1.12325.1.200.1.11.1.0": "87", // rules count
    // UCD CPU
    "1.3.6.1.4.1.2021.11.9.0": "6", "1.3.6.1.4.1.2021.11.10.0": "3", "1.3.6.1.4.1.2021.11.11.0": "90",
    "1.3.6.1.4.1.2021.11.50.0": "4000", "1.3.6.1.4.1.2021.11.51.0": "400", "1.3.6.1.4.1.2021.11.52.0": "2000",
    "1.3.6.1.4.1.2021.11.54.0": "80", "1.3.6.1.4.1.2021.11.56.0": "120",
    "1.3.6.1.4.1.2021.11.59.0": "850", "1.3.6.1.4.1.2021.11.60.0": "1500",
    // UCD memory (KB)
    "1.3.6.1.4.1.2021.4.3.0": "2097148", "1.3.6.1.4.1.2021.4.4.0": "2000000",
    "1.3.6.1.4.1.2021.4.5.0": "8165396", "1.3.6.1.4.1.2021.4.6.0": "3265000",
    "1.3.6.1.2.1.25.1.1.0": "129600000"
});
// IF-MIB: per ifIndex 1 = em0, 2 = em1
const IF = {
    1: { hcIn: "1000000", hcOut: "500000", inDisc: "11", inErr: "12", type: "6", oper: "1", outDisc: "13", outErr: "14", speed: "1000" },
    2: { hcIn: "0", hcOut: "0", inDisc: "0", inErr: "0", type: "6", oper: "2", outDisc: "0", outErr: "0", speed: "10" }
};
Object.keys(IF).forEach((i) => {
    const v = IF[i];
    mib["1.3.6.1.2.1.31.1.1.1.6." + i] = v.hcIn;
    mib["1.3.6.1.2.1.31.1.1.1.10." + i] = v.hcOut;
    mib["1.3.6.1.2.1.2.2.1.13." + i] = v.inDisc;
    mib["1.3.6.1.2.1.2.2.1.14." + i] = v.inErr;
    mib["1.3.6.1.2.1.2.2.1.3." + i] = v.type;
    mib["1.3.6.1.2.1.2.2.1.8." + i] = v.oper;
    mib["1.3.6.1.2.1.2.2.1.19." + i] = v.outDisc;
    mib["1.3.6.1.2.1.2.2.1.20." + i] = v.outErr;
    mib["1.3.6.1.2.1.31.1.1.1.15." + i] = v.speed;
});
// pfInterfaces: value = column * 1000 + row * 10, so each cell is traceable
const pfCell = (col, name) => String(col * 1000 + PF_ROW[name] * 10);
const PF_COLS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
Object.keys(PF_ROW).forEach((name) => {
    PF_COLS.forEach((col) => { mib[PF + "." + col + "." + PF_ROW[name]] = pfCell(col, name); });
});
const pfNames = {};
Object.keys(PF_ROW).forEach((name) => { pfNames[PF + ".2." + PF_ROW[name]] = name; });
// UCD laTable
const laNames = { [LA + ".2.1"]: "Load-1", [LA + ".2.2"]: "Load-5", [LA + ".2.3"]: "Load-15" };
mib[LA + ".3.1"] = "0.31"; mib[LA + ".3.2"] = "0.42"; mib[LA + ".3.3"] = "0.37";
// HOST-RESOURCES-MIB
const runNames = { [HR_RUN + ".2.1"]: "kernel", [HR_RUN + ".2.512"]: "dhcpd", [HR_RUN + ".2.600"]: "unbound", [HR_RUN + ".2.733"]: "nginx" };
mib[HR_RUN + ".7.512"] = "1"; mib[HR_RUN + ".7.600"] = "1"; mib[HR_RUN + ".7.733"] = "1";
const cpus = { [CPU + ".196608"]: "3", [CPU + ".196609"]: "5", [CPU + ".196610"]: "2", [CPU + ".196611"]: "9" };

const get = (oid) => ({ kind: "snmp", method: "get", target: oid, reply: reply.snmp({ [oid]: mib[oid] }) });
const walk = (root, table) => ({ kind: "snmp", method: "walk", target: root, reply: reply.snmp(table) });
const ssh = (command, out) => ({ kind: "ssh", method: "sendSSHCommand", target: command, reply: reply.ssh(out) });
const repeat = (n, call) => Array.from({ length: n }, () => call);

const SERVICES = {
    bsnmpd: "root  41  0.0  0.1  14000  7000  -  Ss  10:00  0:02.10 /usr/sbin/bsnmpd -c /var/etc/snmpd.conf",
    dpinger: "root  90  0.0  0.1  12000  5000  -  Ss  10:00  0:10.00 /usr/local/bin/dpinger -S -r 0 -i WANGW",
    ntpd: "root  71  0.0  0.1  20000  9000  -  S   10:00  0:01.90 /usr/local/sbin/ntpd -g -c /var/etc/ntpd.conf",
    openvpn: "",
    sshd: "root  300  0.0  0.1  16000  8000  -  Is  10:00  0:00.30 sshd: /usr/sbin/sshd [listener]",
    syslogd: "root  250  0.0  0.1  12000  5000  -  Ss  10:00  0:00.50 /usr/sbin/syslogd -s -c -c -l /var/dhcpd/var/run/log",
    unbound: "unbound  600  0.2  0.6  60000  30000  -  Ss  10:00  1:00.00 /usr/local/sbin/unbound -c /var/unbound/unbound.conf"
};
const DNS_CMD = "grep \"nameserver\" /etc/resolv.conf | awk '{system(\"dig +tries=1 @\" $2 \" google.com > /dev/null; echo \" $2 \":$?\")}'";

function statusCalls() {
    const calls = [];
    Object.keys(SERVICES).forEach((svc) => calls.push(ssh("ps aux | grep " + svc + " | grep -v grep", SERVICES[svc])));
    calls.push(ssh(DNS_CMD, "8.8.8.8:0\n192.168.1.53:9\n"));
    // scalars
    ["1.3.6.1.4.1.2021.11.9.0", "1.3.6.1.4.1.2021.11.10.0", "1.3.6.1.4.1.2021.11.11.0",
        "1.3.6.1.4.1.2021.11.56.0", "1.3.6.1.4.1.2021.11.54.0", "1.3.6.1.4.1.2021.11.51.0", "1.3.6.1.4.1.2021.11.52.0", "1.3.6.1.4.1.2021.11.50.0",
        "1.3.6.1.4.1.2021.11.60.0", "1.3.6.1.4.1.2021.4.3.0", "1.3.6.1.4.1.2021.4.4.0", "1.3.6.1.4.1.2021.4.5.0", "1.3.6.1.4.1.2021.4.6.0",
        "1.3.6.1.4.1.12325.1.200.1.11.1.0", "1.3.6.1.4.1.12325.1.200.1.2.3.0", "1.3.6.1.4.1.2021.11.59.0", "1.3.6.1.4.1.12325.1.200.1.2.5.0",
        "1.3.6.1.4.1.12325.1.200.1.1.1.0", "1.3.6.1.4.1.12325.1.200.1.2.6.0", "1.3.6.1.4.1.12325.1.200.1.2.1.0", "1.3.6.1.4.1.12325.1.200.1.2.2.0",
        "1.3.6.1.4.1.12325.1.200.1.2.4.0", "1.3.6.1.4.1.12325.1.200.1.4.1.0", "1.3.6.1.4.1.12325.1.200.1.5.2.0", "1.3.6.1.4.1.12325.1.200.1.3.1.0",
        "1.3.6.1.4.1.12325.1.200.1.5.1.0", "1.3.6.1.2.1.25.1.1.0"].forEach((oid) => calls.push(get(oid)));
    // IF-MIB, per ifIndex
    [1, 2].forEach((i) => {
        ["1.3.6.1.2.1.31.1.1.1.6.", "1.3.6.1.2.1.31.1.1.1.10.", "1.3.6.1.2.1.2.2.1.13.", "1.3.6.1.2.1.2.2.1.14.", "1.3.6.1.2.1.2.2.1.3.",
            "1.3.6.1.2.1.2.2.1.8.", "1.3.6.1.2.1.2.2.1.19.", "1.3.6.1.2.1.2.2.1.20.", "1.3.6.1.2.1.31.1.1.1.15."].forEach((p) => calls.push(get(p + i)));
    });
    // pfInterfaces: 17 walk+get pairs per interface (em0, em1)
    ["em0", "em1"].forEach((name) => {
        calls.push(...repeat(PF_COLS.length, walk(PF + ".2", pfNames)));
        PF_COLS.forEach((col) => calls.push(get(PF + "." + col + "." + PF_ROW[name])));
    });
    // cpu count, load averages, processes
    calls.push(walk(CPU, cpus));
    calls.push(...repeat(3, walk(LA + ".2", laNames)));
    [1, 2, 3].forEach((i) => calls.push(get(LA + ".3." + i)));
    calls.push(...repeat(3, walk(HR_RUN + ".2", runNames)));
    [512, 600, 733].forEach((pid) => calls.push(get(HR_RUN + ".7." + pid)));
    return calls;
}

module.exports = {
    cases: [{
        name: "pfsense 2.6.0 two NICs",
        entryPoints: {
            validate: {
                calls: [get("1.3.6.1.4.1.12325.1.200.1.2.1.0"), ssh("ls", "bin\nboot\netc")]
            },
            get_status: { calls: statusCalls() }
        }
    }]
};
