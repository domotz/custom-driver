// Simulated Debian 10 (systemd 241) replies. Shape follows `systemctl --all --type=service` piped (no tty):
// header UNIT LOAD ACTIVE SUB DESCRIPTION, one unit per line (failed units start with the "●" bullet),
// then the legend footer (7 lines with --all). Piped through the driver's sed/tail/awk/head/grep, so the
// device prints "<name> <SUB>" per unit; the leftover footer line is dropped by the final grep -E filter.
const reply = require("../../replies");

const SERVICES = ["apache", "http", "mysql", "snmp", "ssh", "zabbix"];
const COMMAND = "systemctl --all --type=service | sed -e 's/.service//' | tail -n +2 | awk '{print $1,$4}' | head -n -6 | grep -v 'inactive\\|systemd-fsck' | grep -E " + SERVICES.join("\\|");

// Output of the whole pipeline on the device, as the shell prints it.
const OUTPUT = [
    "apache2 running",
    "cron running",
    "mariadb running",
    "snmpd running",
    "ssh running",
    "zabbix-agent exited",
    "apache-htcacheclean dead",
    ""
].join("\n");

module.exports = {
    cases: [{
        name: "debian 10",
        parameters: { services: SERVICES },
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(OUTPUT) }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(OUTPUT) }] }
        }
    }]
};
