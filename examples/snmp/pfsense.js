/**
 * This driver extract multiple monitoring parameters for pfsense
 * Communication protocol is snmp and ssh
 * Create multiple monitoring variables for pfsense system
 * SSH Daemon should be enabled in pfsense, please check this documentation to enable it: https://docs.netgate.com/pfsense/en/latest/recipes/ssh-access.html
 * SNMP Daemon should be enabled in pfsense, please check this documentation to enable it: https://docs.netgate.com/pfsense/en/latest/services/snmp.html
 * Tested under pfsense 2.6.0-RELEASE
 */

var createSNMPSession = D.device.createSNMPSession;
var createVar = D.device.createVariable;

/** ssh init */

var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

var dnsServersCmd = "grep \"nameserver\" /etc/resolv.conf | awk '{system(\"dig +tries=1 @\" $2 \" google.com > /dev/null; echo \" $2 \":$?\")}'";

/**
 * execute an ssh command and pass the result to the next function
 * @param {any} last data received from previous callback
 * @param {function} next callback function that will pass the result to the next function
 */
function execCommand(last, next) {
    var config = clone({ command: this.command }, sshConfig);
    D.device.sendSSHCommand(config, function (out, err) {
        next(out ? out.split("\n") : null);

    });
}

/**
 * 
 * @param {number} n number to convert to binary
 * @returns number converted to binary
 */
function toBin(n) {
    return n && parseInt(n).toString(2) || "";
}

/**
 * parse dns servers passed under last parameter
 * @param {any} last dns servers list to be parsed
 * @param {function} next callback function that will pass the result to the next function
 */
function getDnsServers(last, next) {
    var self = this;
    var results = last;
    self.variable = [];
    results.forEach(function (r) {
        var dnsStatus = r.split(":");
        self.variable.push(createVar("dns_" + dnsStatus[0], "DNS(" + dnsStatus[0] + ")", dnsStatus[1] == 0 ? "on" : "off"));
    });
    next(self.variable);

}

// checking process status sequence (build ssh command -> excute the command -> check if the process is on or off)
var serviceStatusExec = [
    function (last, next) {
        this.command = "ps aux | grep " + this.service + " | grep -v grep";
        next(this.command);
    },
    execCommand,
    function (last, next) {
        this.variable = createVar(this.service, this.label, last && last.length > 0 ? "on" : "off");
        next(this.variable);
    }
];


/** snmp init */
/**
 * snmp walk
 * @param {any} last data received from the previous callback
 * @param {function} callback callback function that will pass the result to the next function
 */
function snmpWalk(last, callback) {
    var self = this;
    createSNMPSession().walk(self.walkRoot, function (result, error) {
        if (error) {
            console.log("walk error for oid: " + self.walkRoot);
            console.log(error);
            return callback(null);
        }
        callback(result);
    });
}

/**
 * create the corresponding oid for a specific parameter
 * @param {[any]} walkResult list of walk oid and their values
 * @param {function} callback callback function that will pass the result to the next function
 */
function updateOid(walkResult, callback) {
    if (!walkResult) return callback(null);
    for (var key in walkResult) {
        if (walkResult[key] == this.walkParamName) {
            var oidArray = key.split(".");
            var index = oidArray[oidArray.length - 1];
            this.oid = this.walkOid + "." + index;
            break;
        }
    }
    callback(this.oid);
}


/**
 * snmp get
 * @param {any} last data received from the previous callback
 * @param {function} callback callback function that will pass the result to the next function
 */
function snmpGet(last, callback) {
    var self = this;
    if (self.oid) {
        createSNMPSession().get([self.oid], function (result, error) {
            if (error) {
                console.error(error);
                return callback(null);
            }
            if (!result) {
                result = {};
                result[self.oid] = "error";
            }
            self.result = result[self.oid];
            callback(self.result);

        });
    } else {
        callback(null);
    }
}

/**
 * 
 * generate domotz variable
 */
function snmpGenerateVariable(result, callback) {
    this.variable = createVar(this.uid, this.label, this.result, this.unit);
    callback(this.variable);
}

/**
 * 
 * devide the result by the cpu count
 */
function divideByCpuCount(last, next) {
    var nCPU = getResult("1.3.6.1.2.1.25.3.3.1.2.cpus");
    this.result = this.result / nCPU;
    next(this);
}

/**
 * 
 * multiply the result by a number specified in the argument
 */
function multiplyResult(number) {
    return function (last, next) {
        this.result = this.result * number;
        next(this);
    };
}

var snmpGetExec = [snmpGet, snmpGenerateVariable];
var snmpGetByCpuExec = [snmpGet, divideByCpuCount, snmpGenerateVariable];
var snmpWalkGetExec = [snmpWalk, updateOid, snmpGet, snmpGenerateVariable];
var snmpGetMultiply8Exec = [snmpGet, multiplyResult(8), snmpGenerateVariable];
var snmpWalkGetMultiply8Exec = [snmpWalk, updateOid, snmpGet, multiplyResult(8), snmpGenerateVariable];

// list of variables that will be shown as result
var configParameters = [
    { service: "bsnmpd", label: "SNMP Service", exec: serviceStatusExec },
    { service: "dpinger", label: "Gateway Monitoring Daemon", exec: serviceStatusExec },
    { service: "ntpd", label: "NTP clock sync", exec: serviceStatusExec },
    { service: "openvpn", label: "OpenVPN server", exec: serviceStatusExec },
    { service: "sshd", label: "Secure Shell Daemon", exec: serviceStatusExec },
    { service: "syslogd", label: "System Logger Daemon", exec: serviceStatusExec },
    { service: "unbound", label: "DNS Resolver", exec: serviceStatusExec },
    {
        command: dnsServersCmd,
        exec: [execCommand, getDnsServers]
    },
    {
        walkRoot: "1.3.6.1.2.1.25.3.3.1.2",
        walkParamName: "cpus",
        exec: [snmpWalk, function (result, callback) {
            this.result = Object.keys(result).length;
            this.oid = this.walkRoot + "." + this.walkParamName;
            callback(this);
        }, snmpGenerateVariable],
        uid: "cpu_count",
        label: "Number of CPUs",
        unit: "",
        order: 0,
    },
    {
        uid: "user_cpu_time",
        oid: "1.3.6.1.4.1.2021.11.9.0",
        label: "User CPU time",
        unit: "%",
        exec: snmpGetExec
    },
    {
        uid: "system_cpu_time",
        oid: "1.3.6.1.4.1.2021.11.10.0",
        label: "System CPU time",
        unit: "%",
        exec: snmpGetExec
    },
    {
        uid: "idle_cpu_time",
        oid: "1.3.6.1.4.1.2021.11.11.0",
        label: "Idle CPU time",
        unit: "%",
        exec: snmpGetExec
    },
    {
        uid: "cpu_interrupt_time",
        oid: "1.3.6.1.4.1.2021.11.56.0",
        label: "CPU interrupt time",
        unit: "%",
        exec: snmpGetByCpuExec
    },
    {
        uid: "cpu_iowait_time",
        oid: "1.3.6.1.4.1.2021.11.54.0",
        label: "CPU iowait time",
        unit: "%",
        exec: snmpGetByCpuExec
    },
    {
        uid: "cpu_nice_time",
        oid: "1.3.6.1.4.1.2021.11.51.0",
        label: "CPU nice time",
        unit: "%",
        exec: snmpGetByCpuExec
    },
    {
        uid: "cpu_system_time",
        oid: "1.3.6.1.4.1.2021.11.52.0",
        label: "CPU system time",
        unit: "%",
        exec: snmpGetByCpuExec
    },
    {
        uid: "cpu_user_time",
        oid: "1.3.6.1.4.1.2021.11.50.0",
        label: "CPU user time",
        unit: "%",
        exec: snmpGetByCpuExec
    },
    {

        uid: "context_switches_per_second",
        oid: "1.3.6.1.4.1.2021.11.60.0",
        label: "Context switches per second",
        unit: "",
        exec: snmpGetExec
    },
    {
        uid: "total_swap_size",
        oid: "1.3.6.1.4.1.2021.4.3.0",
        label: "Total Swap Size",
        unit: "Kb",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "available_swap_space",
        oid: "1.3.6.1.4.1.2021.4.4.0",
        label: "Available Swap Space",
        unit: "Kb",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "swap_usage",
        label: "Swap usage",
        unit: "%",
        exec: [function (last, next) {
            var total = getResult("1.3.6.1.4.1.2021.4.3.0");
            var avail = getResult("1.3.6.1.4.1.2021.4.4.0");
            this.result = parseInt(100 - (avail / total) * 100);
            next(this);
        }, snmpGenerateVariable]
    },
    {
        uid: "total_ram_in_machine",
        oid: "1.3.6.1.4.1.2021.4.5.0",
        label: "Total RAM in machine",
        unit: "Kb",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "total_ram_available",
        oid: "1.3.6.1.4.1.2021.4.6.0",
        label: "Total RAM Available",
        unit: "Kb",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "memory_usage",
        label: "Memory usage",
        unit: "%",
        exec: [function (last, next) {
            var total = getResult("1.3.6.1.4.1.2021.4.5.0");
            var avail = getResult("1.3.6.1.4.1.2021.4.6.0");
            this.result = parseInt(100 - (avail / total) * 100);
            next(this);
        }, snmpGenerateVariable]
    },
    {

        uid: "dhcp_server_status",
        walkRoot: "1.3.6.1.2.1.25.4.2.1.2",
        walkParamName: "dhcpd",
        walkOid: "1.3.6.1.2.1.25.4.2.1.7",
        exec: snmpWalkGetExec,
        label: "DHCP server status",
        unit: ""
    },
    {
        uid: "dns_server_status",
        walkRoot: "1.3.6.1.2.1.25.4.2.1.2",
        walkParamName: "unbound",
        walkOid: "1.3.6.1.2.1.25.4.2.1.7",
        exec: snmpWalkGetExec,
        label: "DNS server status",
        unit: ""
    },
    {
        uid: "firewall_rules_count",
        oid: "1.3.6.1.4.1.12325.1.200.1.11.1.0",
        label: "Firewall rules count",
        unit: "",
        exec: snmpGetExec
    },
    {
        uid: "fragmented_packets",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.3.0",
        label: "Fragmented packets",
        unit: "pps",
        exec: snmpGetExec
    },
    {
        uid: "interface_em0_bits_received",
        oid: "1.3.6.1.2.1.31.1.1.1.6.1",
        label: "Interface [em0()]: Bits received",
        unit: "bps",
        exec: snmpGetMultiply8Exec
    },
    {
        uid: "Interface_em0_bits_sent",
        oid: "1.3.6.1.2.1.31.1.1.1.10.1",
        label: "Interface [em0()]: Bits sent",
        unit: "bps",
        exec: snmpGetMultiply8Exec
    },
    {

        uid: "interface_em0_inbound_ipv4_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.12",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Inbound IPv4 packets blocked",
        unit: "pps",
    },
    {

        uid: "interface_em0_inbound_ipv4_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.11",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Inbound IPv4 packets passed",
        unit: "pps",
    },
    {
        uid: "interface_em0_inbound_ipv4_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.8",
        exec: snmpWalkGetMultiply8Exec,
        label: "Interface [em0()]: Inbound IPv4 traffic blocked",
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_ipv4_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.7",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Inbound IPv4 traffic passed",
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_ipv6_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.20",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Inbound IPv6 packets blocked",
        unit: "pps"
    },
    {
        uid: "interface_em0_inbound_ipv6_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.19",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Inbound IPv6 packets passed",
        unit: "pps"
    },
    {
        uid: "interface_em0_inbound_ipv6_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.16",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Inbound IPv6 traffic blocked",
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_ipv6_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.15",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Inbound IPv6 traffic passed",
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_packets_discarded",
        oid: "1.3.6.1.2.1.2.2.1.13.1",
        label: "Interface [em0()]: Inbound packets discarded",
        unit: "",
        exec: snmpGetExec
    },
    {
        uid: "interface_em0_inbound_packets_with_errors",
        oid: "1.3.6.1.2.1.2.2.1.14.1",
        label: "Interface [em0()]: Inbound packets with errors",
        unit: "",
        exec: snmpGetExec
    },
    {
        uid: "interface_em0_interface_type",
        oid: "1.3.6.1.2.1.2.2.1.3.1",
        label: "Interface [em0()]: Interface type",
        unit: "",
        exec: snmpGetExec
    },
    {
        uid: "interface_em0_operational_status",
        oid: "1.3.6.1.2.1.2.2.1.8.1",
        label: "Interface [em0()]: Operational status",
        unit: "",
        exec: snmpGetExec
    },
    {
        uid: "interface_em0_outbound_ipv4_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.14",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv4 packets blocked",
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv4_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.13",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv4 packets passed",
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv4_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.10",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv4 traffic blocked",
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_ipv4_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.9",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv4 traffic passed",
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_ipv6_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.22",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv6 packets blocked",
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv6_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.21",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv6 packets passed",
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv6_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.18",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv6 traffic blocked",
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_ipv6_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.17",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Outbound IPv6 traffic passed",
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_packets_discarded",
        oid: "1.3.6.1.2.1.2.2.1.19.1",
        label: "Interface [em0()]: Outbound packets discarded",
        unit: "",
        exec: snmpGetExec,
    },
    {
        uid: "interface_em0_outbound_packets_with_errors",
        oid: "1.3.6.1.2.1.2.2.1.20.1",
        label: "Interface [em0()]: Outbound packets with errors",
        exec: snmpGetExec,
        unit: ""
    },
    {
        uid: "interface_em0_rules_references_count",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em0",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.6",
        exec: snmpWalkGetExec,
        label: "Interface [em0()]: Rules references count",
        unit: ""
    },
    {
        uid: "interface_em0_speed",
        oid: "1.3.6.1.2.1.31.1.1.1.15.1",
        label: "Interface [em0()]: Speed",
        exec: snmpGetExec,
        unit: "bps"
    },
    {
        uid: "interface_em1_bits_received",
        oid: "1.3.6.1.2.1.31.1.1.1.6.2",
        label: "Interface [em1()]: Bits received",
        exec: snmpGetExec,
        unit: "bps"
    },
    {
        uid: "interface_em1_bits_sent",
        oid: "1.3.6.1.2.1.31.1.1.1.10.2",
        label: "Interface [em1()]: Bits sent",
        exec: snmpGetExec,
        unit: "bps"
    },
    {
        uid: "interface_em1_inbound_ipv4_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.12",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv4 packets blocked",
        unit: "pps"
    },
    {
        uid: "interface_em1_inbound_ipv4_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.11",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv4 packets passed",
        unit: "pps"
    },
    {
        uid: "interface_em1_inbound_ipv4_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.8",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv4 traffic blocked",
        unit: "bps"
    },
    {
        uid: "interface_em1_inbound_ipv4_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.7",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv4 traffic passed",
        unit: "bps",
    },
    {
        uid: "interface_em1_inbound_ipv6_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.20",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv6 packets blocked",
        unit: "pps",
    },
    {
        uid: "interface_em1_inbound_ipv6_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.19",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv6 packets passed",
        unit: "pps",
    },
    {
        uid: "interface_em1_inbound_ipv6_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.16",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv6 traffic blocked",
        unit: "bps",
    },
    {
        uid: "interface_em1_inbound_ipv6_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.15",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Inbound IPv6 traffic passed",
        unit: "bps",
    },
    {
        uid: "interface_em1_inbound_packets_discarded",
        label: "Interface [em1()]: Inbound packets discarded",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.13.2",
        exec: snmpGetExec
    },
    {
        uid: "interface_em1_inbound_packets_with_errors",
        label: "Interface [em1()]: Inbound packets with errors",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.14.2",
        exec: snmpGetExec
    },
    {
        uid: "interface_em1_interface_type",
        label: "Interface [em1()]: Interface type",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.3.2",
        exec: snmpGetExec
    },
    {
        uid: "interface_em1_operational_status",
        label: "Interface [em1()]: Operational status",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.8.2",
        exec: snmpGetExec
    },
    {
        uid: "interface_em1_outbound_ipv4_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.14",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv4 packets blocked",
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv4_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.13",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv4 packets passed",
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv4_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.10",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv4 traffic blocked",
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_ipv4_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.9",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv4 traffic passed",
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_ipv6_packets_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.22",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv6 packets blocked",
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv6_packets_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.21",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv6 packets passed",
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv6_traffic_blocked",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.18",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv6 traffic blocked",
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_ipv6_traffic_passed",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.17",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Outbound IPv6 traffic passed",
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_packets_discarded",
        label: "Interface [em1()]: Outbound packets discarded",
        unit: "",
        oid: "1.3.6.1.2.1.2.2.1.19.2",
        exec: snmpGetExec
    },
    {
        uid: "interface_em1_outbound_packets_with_errors",
        label: "Interface [em1()]: Outbound packets with errors",
        unit: "",
        oid: "1.3.6.1.2.1.2.2.1.20.2",
        exec: snmpGetExec
    },
    {
        uid: "interface_em1_rules_references_count",
        walkRoot: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walkParamName: "em1",
        walkOid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.6",
        exec: snmpWalkGetExec,
        label: "Interface [em1()]: Rules references count",
        unit: "",
    },
    {
        uid: "interface_em1_speed",
        label: "Interface [em1()]: Speed",
        unit: "Mbps",
        oid: "1.3.6.1.2.1.31.1.1.1.15.2",
        exec: snmpGetExec
    },
    {
        uid: "interrupts_per_second",
        label: "Interrupts per second",
        unit: "",
        oid: "1.3.6.1.4.1.2021.11.59.0",
        exec: snmpGetExec
    },
    {
        uid: "load_average_1m_avg",
        walkRoot: "1.3.6.1.4.1.2021.10.1.2",
        walkParamName: "Load-1",
        walkOid: "1.3.6.1.4.1.2021.10.1.3",
        exec: snmpWalkGetExec,
        label: "Load average (1m avg)",
        unit: "",
    },
    {
        uid: "load_average_5m_avg",
        walkRoot: "1.3.6.1.4.1.2021.10.1.2",
        walkParamName: "Load-5",
        walkOid: "1.3.6.1.4.1.2021.10.1.3",
        exec: snmpWalkGetExec,
        label: "Load average (5m avg)",
        unit: "",
    },
    {
        uid: "load_average_15m_avg",
        walkRoot: "1.3.6.1.4.1.2021.10.1.2",
        walkParamName: "Load-15",
        walkOid: "1.3.6.1.4.1.2021.10.1.3",
        exec: snmpWalkGetExec,
        label: "Load average (15m avg)",
        unit: "",
    },
    {
        uid: "normalized_packets",
        label: "Normalized packets",
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.5.0",
        exec: snmpGetExec
    },
    {
        uid: "packet_filter_running_status",
        label: "Packet filter running status",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.1.1.0",
        exec: snmpGetExec
    },
    {
        uid: "packets_dropped_due_to_memory_limitation",
        label: "Packets dropped due to memory limitation",
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.6.0",
        exec: snmpGetExec
    },
    {
        uid: "packets_matched_a_filter_rule",
        label: "Packets matched a filter rule",
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.1.0",
        exec: snmpGetExec
    },
    {
        uid: "packets_with_bad_offset",
        label: "Packets with bad offset",
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.2.0",
        exec: snmpGetExec
    },
    {
        uid: "short_packets",
        label: "Short packets",
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.4.0",
        exec: snmpGetExec
    },
    {
        uid: "source_tracking_table_current",
        label: "Source tracking table current",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.4.1.0",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "source_tracking_table_limit",
        label: "Source tracking table limit",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.5.2.0",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "source_tracking_table_utilization",
        label: "Source tracking table utilization",
        unit: "%",
        exec: [function (last, next) {
            var count = getResult("1.3.6.1.4.1.12325.1.200.1.4.1.0");
            var limit = getResult("1.3.6.1.4.1.12325.1.200.1.5.2.0");
            this.result = (count * 100) / limit;
            next(this);
        }, snmpGenerateVariable],
    },
    {
        uid: "state_of_nginx_process",
        walkRoot: "1.3.6.1.2.1.25.4.2.1.2",
        walkParamName: "nginx",
        walkOid: "1.3.6.1.2.1.25.4.2.1.7",
        exec: snmpWalkGetExec,
        label: "State of nginx process",
        unit: "",
    },
    {
        uid: "states_table_current",
        label: "States table current",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.3.1.0",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "states_table_limit",
        label: "States table limit",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.5.1.0",
        order: 0,
        exec: snmpGetExec
    },
    {
        uid: "states_table_utilization",
        label: "States table utilization",
        unit: "%",
        exec: [function (last, next) {
            var count = getResult("1.3.6.1.4.1.12325.1.200.1.3.1.0");
            var limit = getResult("1.3.6.1.4.1.12325.1.200.1.5.1.0");
            this.result = (count * 100) / limit;
            next(this);
        }, snmpGenerateVariable],
    },
    {
        uid: "system_contact_details",
        label: "System contact details",
        unit: "",
        oid: "1.3.6.1.2.1.1.4.0",
        exec: snmpGetExec
    },
    {
        uid: "system_description",
        label: "System description",
        unit: "",
        oid: "1.3.6.1.2.1.1.1.0",
        exec: snmpGetExec
    },
    {
        uid: "system_location",
        label: "System location",
        unit: "",
        oid: "1.3.6.1.2.1.1.6.0",
        exec: snmpGetExec
    },
    {
        uid: "system_name",
        label: "System name",
        unit: "",
        oid: "1.3.6.1.2.1.1.5.0",
        exec: snmpGetExec
    },
    {
        uid: "system_object_id",
        label: "System object ID",
        unit: "",
        oid: "1.3.6.1.2.1.1.2.0",
        exec: snmpGetExec
    },
    {
        uid: "uptime",
        label: "Uptime",
        unit: "uptime",
        oid: "1.3.6.1.2.1.25.1.1.0",
        exec: snmpGetExec
    }
];

/**
 * 
 * @param {any} init initial object
 * @param {any} object object to clone and merge with init
 * @returns cloned object
 */
function clone(init, object) {
    var toReturn = JSON.parse(JSON.stringify(object));
    Object.keys(init).forEach(function (key) {
        toReturn[key] = init[key];
    });
    return toReturn;
}

/**
 * 
 * @param {[function]} arrayFn array functions to execute simultaneously
 * @param {*} callback function will be called when all arrayFn are executed
 */
function executeAll(arrayFn, callback) {
    if (arrayFn.length == 0) {
        callback([]);
    }
    var length = arrayFn.length;
    var results = new Array(length);
    var finished = 0;
    arrayFn.forEach(function (fn, index) {
        fn(function (result) {
            results[index] = result;
            if (++finished == length) {
                callback(results);
            }
        });
    });
}

/**
 * 
 * @param {[function]} functions array of functions to execute sequently
 * @param {*} callback function will be called when all functions are executed
 */
function executeSeq(functions, callback) {
    var self = this;
    var callbackResult = null;
    function executeNext(functionIndex) {
        if (functionIndex == functions.length) return callback.apply(self, [callbackResult]);
        functions[functionIndex].apply(self, [callbackResult, function (result) {
            callbackResult = result;
            executeNext.apply(self, [++functionIndex]);
        }]);
    }
    executeNext.apply(self, [0]);
}

/**
 * get result attribute from configParameters list for the specified oid
 * @param {string} oid snmp oid
 * @returns the specified result
 */
function getResult(oid) {
    return configParameters.filter(function (p) {
        return p.oid == oid;
    }).map(function (p) {
        return p.result;
    })[0];
}

/**
 * 
 * @param {[any]} config list of parameter to extract
 * @param {function} callback function to execute when all results are filled in config parameter
 */
function executeConfig(config, callback) {
    var orderGroups = [];
    var orders = config
        .filter(function (p) { return p.order != null; })
        .map(function (p) { return p.order; })
        .reduce(function (a, b) {
            if (a.indexOf(b) < 0) a.push(b);
            return a;
        }, []).sort();

    orders.forEach(function (order) {
        var group = config.filter(function (p) { return p.order == order; });
        orderGroups.push(group);
    });
    var finalGroup = config.filter(function (p) { return p.order == null; });
    orderGroups.push(finalGroup);

    var orderedFns = orderGroups.map(function (params) {
        var fns = params.map(function (p) {
            return function (callback) {
                executeSeq.apply(p, [p.exec, callback]);
            };
        });
        return function (last, next) {
            executeAll(fns, next);
        };
    });
    executeSeq(orderedFns, function () {
        var result = [];
        configParameters.forEach(function (param) {
            if (Array.isArray(param.variable)) {
                param.variable.forEach(function (variable) {
                    result.push(variable);
                });
            } else {
                result.push(param.variable);
            }
        });
        callback(result);
    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    createSNMPSession().get(["1.3.6.1.4.1.12325.1.200.1.2.1.0"], function (result, error) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        D.success();
    });

}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    executeConfig(configParameters, function (result) {
        D.success(result);
    });
}
