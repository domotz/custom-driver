/**
 * This driver extracts information about the network, cpu and some system information for pfsense
 * The communication protocol is SNMP and SSH
 * This driver create a dynamic monitoring variables specified in the variable {@link config_paramters}
 * Tested under pfsense 2.6.0-RELEASE
 */

var createSNMPSession = D.device.createSNMPSession;
var _var = D.device.createVariable;

/** ssh init */

var ssh_config = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

var ntp_status_cmd = "ntpq -p | awk '{print $1 \";\" $2 \";\" $7}'";
var dns_servers_cmd = "grep \"nameserver\" /etc/resolv.conf | awk '{system(\"dig +tries=1 @\" $2 \" google.com > /dev/null; echo \" $2 \":$?\")}'";

function exec_command(last, next) {
    var config = clone({ command: this.command }, ssh_config);
    D.device.sendSSHCommand(config, function (out, err) {
        next(out ? out.split("\n") : null);
        
    });
}

function to_bin(n) {
    return n && parseInt(n).toString(2) || "";
}


function get_ntp_status(last, next) {
    var _this = this;
    var results = last;
    _this._var = [];
    for (var i = 2; i < results.length; i++) {
        var result = results[i].split(";");
        var uid = result[0];
        var label = "NTP: " + result[0] + " (" + result[1] + ")";
        var success = result[2];
        var binSuccess = to_bin(success[2]) + to_bin(success[1]) + to_bin(success[0]);
        var successPrencent = (binSuccess.split("1").length - 1) / 8;
        _this._var.push(_var(uid, label, successPrencent * 100, "%"));
    }
    next(_this._var);
}

function get_dns_servers(last, next) {
    var _this = this;
    var results = last;
    _this._var = [];
    results.forEach(function (r) {
        var dns_status = r.split(":");
        _this._var.push(_var("dns_" + dns_status[0], "DNS(" + dns_status[0] + ")", dns_status[1] == 0 ? "on" : "off"));
    });
    next(_this._var);

}

var service_status_exec = [
    function (last, next) {
        this.command = "ps aux | grep " + this.service + " | grep -v grep";
        next(this.command);
    },
    exec_command,
    function (last, next) {
        this._var = _var(this.service, this.label, last && last.length > 0 ? "on" : "off");
        next(this._var);
    }
];


/** snmp init */

function snmp_walk(last, callback) {
    var _this = this;
    createSNMPSession().walk(_this.walk_root, function (result, error) {
        if (error) {
            console.log("walk error for oid: " + _this.walk_root);
            console.log(error);
            return callback(null);
        }
        callback(result);
    });
}

function update_oid(walk_result, callback) {
    if (!walk_result) return callback(null);
    for (var key in walk_result) {
        if (walk_result[key] == this.walk_param_name) {
            var oidArray = key.split(".");
            var index = oidArray[oidArray.length - 1];
            this.oid = this.walk_oid + "." + index;
            break;
        }
    }
    callback(this.oid);
}

function snmp_get(last, callback) {
    var _this = this;
    if (_this.oid) {
        createSNMPSession().get([_this.oid], function (result, error) {
            if (error) {
                console.error(error);
                return callback(null);
            }
            if (!result) {
                result = {};
                result[_this.oid] = "error";
            }
            _this.result = result[_this.oid];
            callback(_this.result);

        });
    } else {
        callback(null);
    }
}

function snmp_generate_variable(result, callback) {
    this._var = _var(this.uid, this.label, this.result, this.unit, this.type);
    callback(this._var);
}

function update_array(array, index){
    return function(result, callback){
        array[index] = this.result;
        callback(result);
    };
}

function divide_by_cpu_count(last, next) {
    var nCPU = get_result("1.3.6.1.2.1.25.3.3.1.2.cpus");
    this.result = this.result / nCPU;
    next(this);
}

function multiply_result(number) {
    return function (last, next) {
        this.result = this.result * number;
        next(this);
    };
}

function exec(fnSeq, callback){
    var finalSeq = [];
    fnSeq.forEach(function(fn){
        finalSeq.push(fn);
    });
    finalSeq.push(callback);
    return finalSeq;
}

var snmp_get_exec = [snmp_get];
var snmp_get_by_cpu_exec = [snmp_get, divide_by_cpu_count];
var snmp_walk_get_exec = [snmp_walk, update_oid, snmp_get];
var snmp_get_multiply_8_exec = [snmp_get, multiply_result(8)];
var snmp_walk_get_multiply_8_exec = [snmp_walk, update_oid, snmp_get, multiply_result(8)];
var snmp_get_multiply_1000000_exec = [snmp_get, multiply_result(1000000)];
var snmp_walk_get_multiply_1000000_exec = [snmp_walk, update_oid, snmp_get, multiply_result(1000000)];

var em0_row = Array.apply(null, { length: 26 });
var em1_row = Array.apply(null, { length: 26 });
var interface_table = D.createTable("Table interfaces", [
    {label: "Bits received", unit: "bps", type: D.valueType.RATE},
    {label: "Bits sent", unit: "bps", type: D.valueType.RATE},
    {label: "Inbound IPv4 packets blocked", unit: "pps", type: D.valueType.RATE},
    {label: "Inbound IPv4 packets passed", unit: "pps", type: D.valueType.RATE},
    {label: "Inbound IPv4 traffic blocked", unit: "bps", type: D.valueType.RATE},
    {label: "Inbound IPv4 traffic passed", unit: "bps", type: D.valueType.RATE},
    {label: "Inbound IPv6 packets blocked", unit: "pps", type: D.valueType.RATE},
    {label: "Inbound IPv6 packets passed", unit: "pps", type: D.valueType.RATE},
    {label: "Inbound IPv6 traffic blocked", unit: "bps", type: D.valueType.RATE},
    {label: "Inbound IPv6 traffic passed", unit: "bps", type: D.valueType.RATE},
    {label: "Inbound packets discarded"},
    {label: "Inbound packets with errors"},
    {label: "Interface type"},
    {label: "Operational status"},
    {label: "Outbound IPv4 packets blocked", unit: "pps", type: D.valueType.RATE},
    {label: "Outbound IPv4 packets passed", unit: "pps", type: D.valueType.RATE},
    {label: "Outbound IPv4 traffic blocked", unit: "bps", type: D.valueType.RATE},
    {label: "Outbound IPv4 traffic passed", unit: "bps", type: D.valueType.RATE},
    {label: "Outbound IPv6 packets blocked", unit: "pps", type: D.valueType.RATE},
    {label: "Outbound IPv6 packets passed", unit: "pps", type: D.valueType.RATE},
    {label: "Outbound IPv6 traffic blocked", unit: "bps", type: D.valueType.RATE},
    {label: "Outbound IPv6 traffic passed", unit: "bps", type: D.valueType.RATE},
    {label: "Outbound packets discarded"},
    {label: "Outbound packets with errors"},
    {label: "Rules references count"},
    {label: "Speed", unit: "bps"},
]
);

// list of configuration variables to extract
var config_paramters = [
    { service: "bsnmpd", label: "SNMP Service", exec: service_status_exec },
    { service: "dpinger", label: "Gateway Monitoring Daemon", exec: service_status_exec },
    { service: "ntpd", label: "NTP clock sync", exec: service_status_exec },
    { service: "openvpn", label: "OpenVPN server", exec: service_status_exec },
    { service: "sshd", label: "Secure Shell Daemon", exec: service_status_exec },
    { service: "syslogd", label: "System Logger Daemon", exec: service_status_exec },
    { service: "unbound", label: "DNS Resolver", exec: service_status_exec },
    {
        command: dns_servers_cmd,
        exec: [exec_command, get_dns_servers]
    },
    {
        walk_root: "1.3.6.1.2.1.25.3.3.1.2",
        walk_param_name: "cpus",
        exec: [snmp_walk, function (result, callback) {
            this.result = Object.keys(result).length;
            this.oid = this.walk_root + "." + this.walk_param_name;
            callback(this);
        }, snmp_generate_variable],
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
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "system_cpu_time",
        oid: "1.3.6.1.4.1.2021.11.10.0",
        label: "System CPU time",
        unit: "%",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "idle_cpu_time",
        oid: "1.3.6.1.4.1.2021.11.11.0",
        label: "Idle CPU time",
        unit: "%",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "cpu_interrupt_time",
        oid: "1.3.6.1.4.1.2021.11.56.0",
        label: "CPU interrupt time",
        unit: "raw/s",
        type: D.valueType.RATE,
        exec: exec(snmp_get_by_cpu_exec, snmp_generate_variable)
    },
    {
        uid: "cpu_iowait_time",
        oid: "1.3.6.1.4.1.2021.11.54.0",
        label: "CPU iowait time",
        unit: "raw/s",
        type: D.valueType.RATE,
        exec: exec(snmp_get_by_cpu_exec, snmp_generate_variable)
    },
    {
        uid: "cpu_nice_time",
        oid: "1.3.6.1.4.1.2021.11.51.0",
        label: "CPU nice time",
        unit: "raw/s",
        type: D.valueType.RATE,
        exec: exec(snmp_get_by_cpu_exec, snmp_generate_variable)
    },
    {
        uid: "cpu_system_time",
        oid: "1.3.6.1.4.1.2021.11.52.0",
        label: "CPU system time",
        unit: "raw/s",
        type: D.valueType.RATE,
        exec: exec(snmp_get_by_cpu_exec, snmp_generate_variable)
    },
    {
        uid: "cpu_user_time",
        oid: "1.3.6.1.4.1.2021.11.50.0",
        label: "CPU user time",
        unit: "raw/s",
        type: D.valueType.RATE,
        exec: exec(snmp_get_by_cpu_exec, snmp_generate_variable)
    },
    {

        uid: "context_switches_per_second",
        oid: "1.3.6.1.4.1.2021.11.60.0",
        label: "Context switches per second",
        unit: "",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "total_swap_size",
        oid: "1.3.6.1.4.1.2021.4.3.0",
        label: "Total Swap Size",
        unit: "Kb",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "available_swap_space",
        oid: "1.3.6.1.4.1.2021.4.4.0",
        label: "Available Swap Space",
        unit: "Kb",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "swap_usage",
        label: "Swap usage",
        unit: "%",
        exec: [function (last, next) {
            var total = get_result("1.3.6.1.4.1.2021.4.3.0");
            var avail = get_result("1.3.6.1.4.1.2021.4.4.0");
            this.result = parseInt(100 - (avail / total) * 100);
            next(this);
        }, snmp_generate_variable]
    },
    {
        uid: "total_ram_in_machine",
        oid: "1.3.6.1.4.1.2021.4.5.0",
        label: "Total RAM in machine",
        unit: "Kb",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "total_ram_available",
        oid: "1.3.6.1.4.1.2021.4.6.0",
        label: "Total RAM Available",
        unit: "Kb",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "memory_usage",
        label: "Memory usage",
        unit: "%",
        exec: [function (last, next) {
            var total = get_result("1.3.6.1.4.1.2021.4.5.0");
            var avail = get_result("1.3.6.1.4.1.2021.4.6.0");
            this.result = parseInt(100 - (avail / total) * 100);
            next(this);
        }, snmp_generate_variable]
    },
    {

        uid: "dhcp_server_status",
        walk_root: "1.3.6.1.2.1.25.4.2.1.2",
        walk_param_name: "dhcpd",
        walk_oid: "1.3.6.1.2.1.25.4.2.1.7",
        exec: exec(snmp_walk_get_exec, snmp_generate_variable),
        label: "DHCP server status",
        unit: ""
    },
    {
        uid: "dns_server_status",
        walk_root: "1.3.6.1.2.1.25.4.2.1.2",
        walk_param_name: "unbound",
        walk_oid: "1.3.6.1.2.1.25.4.2.1.7",
        exec: exec(snmp_walk_get_exec, snmp_generate_variable),
        label: "DNS server status",
        unit: ""
    },
    {
        uid: "firewall_rules_count",
        oid: "1.3.6.1.4.1.12325.1.200.1.11.1.0",
        label: "Firewall rules count",
        unit: "",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "fragmented_packets",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.3.0",
        label: "Fragmented packets",
        unit: "pps",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "interface_em0_bits_received",
        oid: "1.3.6.1.2.1.31.1.1.1.6.1",
        label: "Interface [em0()]: Bits received",
        unit: "bps",
        type: D.valueType.RATE,
        exec: exec(snmp_get_multiply_8_exec, update_array(em0_row, 0))
    },
    {
        uid: "Interface_em0_bits_sent",
        oid: "1.3.6.1.2.1.31.1.1.1.10.1",
        label: "Interface [em0()]: Bits sent",
        unit: "bps",
        type: D.valueType.RATE,
        exec: exec(snmp_get_multiply_8_exec, update_array(em0_row, 1))
    },
    {

        uid: "interface_em0_inbound_ipv4_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.12",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 2)),
        label: "Interface [em0()]: Inbound IPv4 packets blocked",
        unit: "pps",
        type: D.valueType.RATE,
    },
    {

        uid: "interface_em0_inbound_ipv4_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.11",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 3)),
        label: "Interface [em0()]: Inbound IPv4 packets passed",
        unit: "pps",
        type: D.valueType.RATE,
    },
    {
        uid: "interface_em0_inbound_ipv4_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.8",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 4)),
        label: "Interface [em0()]: Inbound IPv4 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_ipv4_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.7",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 5)),
        label: "Interface [em0()]: Inbound IPv4 traffic passed",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_ipv6_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.20",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 6)),
        label: "Interface [em0()]: Inbound IPv6 packets blocked",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em0_inbound_ipv6_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.19",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 7)),
        label: "Interface [em0()]: Inbound IPv6 packets passed",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em0_inbound_ipv6_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.16",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 8)),
        label: "Interface [em0()]: Inbound IPv6 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_ipv6_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.15",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 9)),
        label: "Interface [em0()]: Inbound IPv6 traffic passed",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_inbound_packets_discarded",
        oid: "1.3.6.1.2.1.2.2.1.13.1",
        label: "Interface [em0()]: Inbound packets discarded",
        type: D.valueType.RATE,
        unit: "",
        exec: exec(snmp_get_exec, update_array(em0_row, 10))
    },
    {
        uid: "interface_em0_inbound_packets_with_errors",
        oid: "1.3.6.1.2.1.2.2.1.14.1",
        label: "Interface [em0()]: Inbound packets with errors",
        type: D.valueType.RATE,
        unit: "",
        exec: exec(snmp_get_exec, update_array(em0_row, 11))
    },
    {
        uid: "interface_em0_interface_type",
        oid: "1.3.6.1.2.1.2.2.1.3.1",
        label: "Interface [em0()]: Interface type",
        unit: "",
        exec: exec(snmp_get_exec, update_array(em0_row, 12))
    },
    {
        uid: "interface_em0_operational_status",
        oid: "1.3.6.1.2.1.2.2.1.8.1",
        label: "Interface [em0()]: Operational status",
        unit: "",
        exec: exec(snmp_get_exec, update_array(em0_row, 13))
    },
    {
        uid: "interface_em0_outbound_ipv4_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.14",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 14)),
        label: "Interface [em0()]: Outbound IPv4 packets blocked",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv4_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.13",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 15)),
        label: "Interface [em0()]: Outbound IPv4 packets passed",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv4_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.10",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 16)),
        label: "Interface [em0()]: Outbound IPv4 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_ipv4_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.9",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 17)),
        label: "Interface [em0()]: Outbound IPv4 traffic passed",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_ipv6_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.22",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 18)),
        label: "Interface [em0()]: Outbound IPv6 packets blocked",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv6_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.21",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 19)),
        label: "Interface [em0()]: Outbound IPv6 packets passed",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em0_outbound_ipv6_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.18",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 20)),
        label: "Interface [em0()]: Outbound IPv6 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_ipv6_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.17",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em0_row, 21)),
        label: "Interface [em0()]: Outbound IPv6 traffic passed",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em0_outbound_packets_discarded",
        oid: "1.3.6.1.2.1.2.2.1.19.1",
        label: "Interface [em0()]: Outbound packets discarded",
        type: D.valueType.RATE,
        unit: "",
        exec: exec(snmp_get_exec, update_array(em0_row, 22)),
    },
    {
        uid: "interface_em0_outbound_packets_with_errors",
        oid: "1.3.6.1.2.1.2.2.1.20.1",
        label: "Interface [em0()]: Outbound packets with errors",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, update_array(em0_row, 23)),
        unit: ""
    },
    {
        uid: "interface_em0_rules_references_count",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em0",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.6",
        exec: exec(snmp_walk_get_exec, update_array(em0_row, 24)),
        label: "Interface [em0()]: Rules references count",
        unit: ""
    },
    {
        uid: "interface_em0_speed",
        oid: "1.3.6.1.2.1.31.1.1.1.15.1",
        label: "Interface [em0()]: Speed",
        exec: exec(snmp_get_multiply_1000000_exec, update_array(em0_row, 25)),
        unit: "bps"
    },
    {
        uid: "interface_em1_bits_received",
        oid: "1.3.6.1.2.1.31.1.1.1.6.2",
        label: "Interface [em1()]: Bits received",
        type: D.valueType.RATE,
        exec: exec(snmp_get_multiply_8_exec, update_array(em1_row, 0)),
        unit: "bps"
    },
    {
        uid: "interface_em1_bits_sent",
        oid: "1.3.6.1.2.1.31.1.1.1.10.2",
        label: "Interface [em1()]: Bits sent",
        type: D.valueType.RATE,
        exec: exec(snmp_get_multiply_8_exec, update_array(em1_row, 1)),
        unit: "bps"
    },
    {
        uid: "interface_em1_inbound_ipv4_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.12",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 2)),
        label: "Interface [em1()]: Inbound IPv4 packets blocked",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em1_inbound_ipv4_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.11",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 3)),
        label: "Interface [em1()]: Inbound IPv4 packets passed",
        type: D.valueType.RATE,
        unit: "pps"
    },
    {
        uid: "interface_em1_inbound_ipv4_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.8",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 4)),
        label: "Interface [em1()]: Inbound IPv4 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps"
    },
    {
        uid: "interface_em1_inbound_ipv4_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.7",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 5)),
        label: "Interface [em1()]: Inbound IPv4 traffic passed",
        type: D.valueType.RATE,
        unit: "bps",
    },
    {
        uid: "interface_em1_inbound_ipv6_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.20",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 6)),
        label: "Interface [em1()]: Inbound IPv6 packets blocked",
        type: D.valueType.RATE,
        unit: "pps",
    },
    {
        uid: "interface_em1_inbound_ipv6_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.19",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 7)),
        label: "Interface [em1()]: Inbound IPv6 packets passed",
        type: D.valueType.RATE,
        unit: "pps",
    },
    {
        uid: "interface_em1_inbound_ipv6_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.16",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 8)),
        label: "Interface [em1()]: Inbound IPv6 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps",
    },
    {
        uid: "interface_em1_inbound_ipv6_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.15",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 9)),
        label: "Interface [em1()]: Inbound IPv6 traffic passed",
        type: D.valueType.RATE,
        unit: "bps",
    },
    {
        uid: "interface_em1_inbound_packets_discarded",
        label: "Interface [em1()]: Inbound packets discarded",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.13.2",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, update_array(em1_row, 10))
    },
    {
        uid: "interface_em1_inbound_packets_with_errors",
        label: "Interface [em1()]: Inbound packets with errors",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.14.2",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, update_array(em1_row, 11))
    },
    {
        uid: "interface_em1_interface_type",
        label: "Interface [em1()]: Interface type",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.3.2",
        exec: exec(snmp_get_exec, update_array(em1_row, 12))
    },
    {
        uid: "interface_em1_operational_status",
        label: "Interface [em1()]: Operational status",
        unit: "", oid: "1.3.6.1.2.1.2.2.1.8.2",
        exec: exec(snmp_get_exec, update_array(em1_row, 13))
    },
    {
        uid: "interface_em1_outbound_ipv4_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.14",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 14)),
        label: "Interface [em1()]: Outbound IPv4 packets blocked",
        type: D.valueType.RATE,
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv4_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.13",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 15)),
        label: "Interface [em1()]: Outbound IPv4 packets passed",
        type: D.valueType.RATE,
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv4_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.10",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 16)),
        label: "Interface [em1()]: Outbound IPv4 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_ipv4_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.9",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 17)),
        label: "Interface [em1()]: Outbound IPv4 traffic passed",
        type: D.valueType.RATE,
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_ipv6_packets_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.22",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 18)),
        label: "Interface [em1()]: Outbound IPv6 packets blocked",
        type: D.valueType.RATE,
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv6_packets_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.21",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 19)),
        label: "Interface [em1()]: Outbound IPv6 packets passed",
        type: D.valueType.RATE,
        unit: "pps",
    },
    {
        uid: "interface_em1_outbound_ipv6_traffic_blocked",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.18",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 20)),
        label: "Interface [em1()]: Outbound IPv6 traffic blocked",
        type: D.valueType.RATE,
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_ipv6_traffic_passed",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.17",
        exec: exec(snmp_walk_get_multiply_8_exec, update_array(em1_row, 21)),
        label: "Interface [em1()]: Outbound IPv6 traffic passed",
        type: D.valueType.RATE,
        unit: "bps",
    },
    {
        uid: "interface_em1_outbound_packets_discarded",
        label: "Interface [em1()]: Outbound packets discarded",
        unit: "",
        oid: "1.3.6.1.2.1.2.2.1.19.2",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, update_array(em1_row, 22))
    },
    {
        uid: "interface_em1_outbound_packets_with_errors",
        label: "Interface [em1()]: Outbound packets with errors",
        unit: "",
        oid: "1.3.6.1.2.1.2.2.1.20.2",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, update_array(em1_row, 23))
    },
    {
        uid: "interface_em1_rules_references_count",
        walk_root: "1.3.6.1.4.1.12325.1.200.1.8.2.1.2",
        walk_param_name: "em1",
        walk_oid: "1.3.6.1.4.1.12325.1.200.1.8.2.1.6",
        exec: exec(snmp_walk_get_exec, update_array(em1_row, 24)),
        label: "Interface [em1()]: Rules references count",
        unit: "",
    },
    {
        uid: "interface_em1_speed",
        label: "Interface [em1()]: Speed",
        unit: "bps",
        oid: "1.3.6.1.2.1.31.1.1.1.15.2",
        exec: exec(snmp_get_multiply_1000000_exec, update_array(em1_row, 25))
    },
    {
        uid: "interrupts_per_second",
        label: "Interrupts per second",
        unit: "",
        oid: "1.3.6.1.4.1.2021.11.59.0",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "normalized_packets",
        label: "Normalized packets",
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.5.0",
        type: D.valueType.RATE,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "load_average_1m_avg",
        walk_root: "1.3.6.1.4.1.2021.10.1.2",
        walk_param_name: "Load-1",
        walk_oid: "1.3.6.1.4.1.2021.10.1.3",
        exec: exec(snmp_walk_get_exec, snmp_generate_variable),
        label: "Load average (1m avg)",
        unit: "",
    },
    {
        uid: "load_average_5m_avg",
        walk_root: "1.3.6.1.4.1.2021.10.1.2",
        walk_param_name: "Load-5",
        walk_oid: "1.3.6.1.4.1.2021.10.1.3",
        exec: exec(snmp_walk_get_exec, snmp_generate_variable),
        label: "Load average (5m avg)",
        unit: "",
    },
    {
        uid: "load_average_15m_avg",
        walk_root: "1.3.6.1.4.1.2021.10.1.2",
        walk_param_name: "Load-15",
        walk_oid: "1.3.6.1.4.1.2021.10.1.3",
        exec: exec(snmp_walk_get_exec, snmp_generate_variable),
        label: "Load average (15m avg)",
        unit: "",
    },
    {
        uid: "packet_filter_running_status",
        label: "Packet filter running status",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.1.1.0",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "packets_dropped_due_to_memory_limitation",
        label: "Packets dropped due to memory limitation",
        type: D.valueType.RATE,
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.6.0",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "packets_matched_a_filter_rule",
        label: "Packets matched a filter rule",
        type: D.valueType.RATE,
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.1.0",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "packets_with_bad_offset",
        label: "Packets with bad offset",
        type: D.valueType.RATE,
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.2.0",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "short_packets",
        label: "Short packets",
        type: D.valueType.RATE,
        unit: "pps",
        oid: "1.3.6.1.4.1.12325.1.200.1.2.4.0",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "source_tracking_tbl_current",
        label: "Source tracking table current",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.4.1.0",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "source_tracking_tbl_limit",
        label: "Source tracking table limit",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.5.2.0",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "source_tracking_tbl_utilization",
        label: "Source tracking table utilization",
        unit: "%",
        exec: [function (last, next) {
            var count = get_result("1.3.6.1.4.1.12325.1.200.1.4.1.0");
            var limit = get_result("1.3.6.1.4.1.12325.1.200.1.5.2.0");
            this.result = (count * 100) / limit;
            next(this);
        }, snmp_generate_variable],
    },
    {
        uid: "state_of_nginx_process",
        walk_root: "1.3.6.1.2.1.25.4.2.1.2",
        walk_param_name: "nginx",
        walk_oid: "1.3.6.1.2.1.25.4.2.1.7",
        exec: exec(snmp_walk_get_exec, snmp_generate_variable),
        label: "State of nginx process",
        unit: "",
    },
    {
        uid: "states_tbl_current",
        label: "States table current",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.3.1.0",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "states_tbl_limit",
        label: "States table limit",
        unit: "",
        oid: "1.3.6.1.4.1.12325.1.200.1.5.1.0",
        order: 0,
        exec: exec(snmp_get_exec, snmp_generate_variable)
    },
    {
        uid: "states_tbl_utilization",
        label: "States table utilization",
        unit: "%",
        exec: [function (last, next) {
            var count = get_result("1.3.6.1.4.1.12325.1.200.1.3.1.0");
            var limit = get_result("1.3.6.1.4.1.12325.1.200.1.5.1.0");
            this.result = (count * 100) / limit;
            next(this);
        }, snmp_generate_variable],
    },
    {
        uid: "uptime",
        label: "Uptime",
        unit: "uptime",
        oid: "1.3.6.1.2.1.25.1.1.0",
        exec: exec(snmp_get_exec, snmp_generate_variable)
    }
];

/**
 * Clone an object
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
 * @param {[Function]} arrayFn list of functions executed in the same time
 * @param {*} callback called when all functions are executed
 */
function execute_all(arrayFn, callback) {
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
 * @param {[Function]} functions list of functions to execute sequentially
 * @param {*} callback called when the sequence of functions is done
 */
function execute_seq(functions, callback) {
    var _this = this;
    var callbackResult = null;
    function executeNext(functionIndex) {
        if (functionIndex == functions.length) return callback.apply(_this, [callbackResult]);
        functions[functionIndex].apply(_this, [callbackResult, function (result) {
            callbackResult = result;
            executeNext.apply(_this, [++functionIndex]);
        }]);
    }
    executeNext.apply(_this, [0]);
}

/**
 * 
 * @param {*} oid snmp oid
 * @returns the result in {@link config_paramters}
 */
function get_result(oid) {
    return config_paramters.filter(function (p) {
        return p.oid == oid;
    }).map(function (p) {
        return p.result;
    })[0];
}

/**
 * 
 * @param {*} config contains list of monitoring variables and the way to extract them
 * @param {*} callback called when all the monitoring variables are fetched
 */
function execute_config(config, callback) {
    var order_groups = [];
    var orders = config
        .filter(function (p) { return p.order != null; })
        .map(function (p) { return p.order; })
        .reduce(function (a, b) {
            if (a.indexOf(b) < 0) a.push(b);
            return a;
        }, []).sort();

    orders.forEach(function (order) {
        var group = config.filter(function (p) { return p.order == order; });
        order_groups.push(group);
    });
    var final_group = config.filter(function (p) { return p.order == null; });
    order_groups.push(final_group);

    var ordred_fns = order_groups.map(function (params) {
        var fns = params.map(function (p) {
            return function (callback) {
                execute_seq.apply(p, [p.exec, callback]);
            };
        });
        return function (last, next) {
            execute_all(fns, next);
        };
    });
    execute_seq(ordred_fns, function () {
        var result = [];
        config_paramters.forEach(function (param) {
            if (Array.isArray(param._var)) {
                param._var.forEach(function (_var) {
                    result.push(_var);
                });
            } else if(param._var) {
                result.push(param._var);
            }
        });
        callback(result);
    });
}
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to check if the snmp and ssh are working in pfsense server
*/
function validate() {
    var valid = 0;
    function success(){
        valid++;
        if(valid == 2){
            D.success();
        }
    }
    createSNMPSession().get(["1.3.6.1.4.1.12325.1.200.1.2.1.0"], function (result, error) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        success();
    });

    var config = clone({ command: "ls" }, ssh_config);
    D.device.sendSSHCommand(config, function (out, err) {
        if(err) checkSshError(err);
        success();
    });


}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data specified in {@link config_paramters}
*/
function get_status() {
    execute_config(config_paramters, function (result) {
        interface_table.insertRecord("em0", em0_row);
        interface_table.insertRecord("em1", em1_row);
        D.success(result, interface_table);

    });
}
