var createSNMPSession = D.device.createSNMPSession;
var _var = D.device.createVariable;


var snmp_parameters = [
	{
		walk: {
			ref: '1.3.6.1.2.1.25.3.3.1.2', name: 'cpus',
			callback: function (param, res) {
				param.result = Object.keys(res).length;
				param.oid = param.walk.ref + '.' + param.walk.name;
			}
		},
		label: 'Number of CPUs',
		unit: '',
		snmpget: false,
		order: 0,
	},
	{
		oid: '1.3.6.1.4.1.2021.11.9.0',
		label: 'User CPU time',
		unit: '%'
	},
	{
		oid: '1.3.6.1.4.1.2021.11.10.0',
		label: 'System CPU time',
		unit: '%'
	},
	{
		oid: '1.3.6.1.4.1.2021.11.11.0',
		label: 'Idle CPU time',
		unit: '%'
	},
	{
		oid: '1.3.6.1.4.1.2021.11.56.0',
		label: 'CPU interrupt time',
		unit: '%',
		postProcess: [divide_by_cpu_count]
	},
	{
		oid: '1.3.6.1.4.1.2021.11.54.0',
		label: 'CPU iowait time',
		unit: '%',
		postProcess: [divide_by_cpu_count]
	},
	{
		oid: '1.3.6.1.4.1.2021.11.51.0',
		label: 'CPU nice time',
		unit: '%',
		postProcess: [divide_by_cpu_count]
	},
	{
		oid: '1.3.6.1.4.1.2021.11.52.0',
		label: 'CPU system time',
		unit: '%',
		postProcess: [divide_by_cpu_count]
	},
	{
		oid: '1.3.6.1.4.1.2021.11.50.0',
		label: 'CPU user time',
		unit: '%',
		postProcess: [divide_by_cpu_count]
	},
	{
		oid: '1.3.6.1.4.1.2021.11.60.0',
		label: 'Context switches per second',
		unit: '',
	},
	{
		oid: '1.3.6.1.4.1.2021.4.3.0',
		label: 'Total Swap Size',
		unit: 'Kb',
		order: 0
	},
	{
		oid: '1.3.6.1.4.1.2021.4.4.0',
		label: 'Available Swap Space',
		unit: 'Kb',
		order: 0
	},
	{
		oid: '__calculated_swap_percentage',
		label: 'Swap usage',
		unit: '%',
		postProcess: [function(last, next){
			var total = get_result('1.3.6.1.4.1.2021.4.4.0');
			var avail = get_result('1.3.6.1.4.1.2021.4.4.0');
			this.result = parseInt(100 - (avail / total) * 100);
			next(this);
		}],
		snmpget: false
	},
	{
		oid: '1.3.6.1.4.1.2021.4.5.0',
		label: 'Total RAM in machine',
		unit: 'Kb'
	},
	{
		oid: '1.3.6.1.4.1.2021.4.6.0',
		label: 'Total RAM Available',
		unit: 'Kb'
	},
	{
		oid: '__calculated_used_memory',
		label: 'Memory usage',
		unit: '%',
		postProcess: [function(last, next){
			var total = get_result('1.3.6.1.4.1.2021.4.5.0');
			var avail = get_result('1.3.6.1.4.1.2021.4.6.0');
			this.result = parseInt(100 - (avail / total) * 100);
			next(this);
		}],
		snmpget: false
	},
	{
		walk: {
			ref: '1.3.6.1.2.1.25.4.2.1.2', name: 'dhcpd', oid: '1.3.6.1.2.1.25.4.2.1.7',
			callback: update_oid
		},
		label: 'DHCP server status',
		unit: ''
	},
	{
		walk: {
			ref: '1.3.6.1.2.1.25.4.2.1.2', name: 'unbound', oid: '1.3.6.1.2.1.25.4.2.1.7',
			callback: update_oid
		},
		label: 'DNS server status',
		unit: ''
	},
	{
		oid: '1.3.6.1.4.1.12325.1.200.1.11.1.0',
		label: 'Firewall rules count',
		unit: ''
	},
	{
		oid: '1.3.6.1.4.1.12325.1.200.1.2.3.0',
		label: 'Fragmented packets',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.2.1.25.4.2.1.2', name: 'unbound', oid: '1.3.6.1.2.1.25.4.2.1.7',
			callback: update_oid
		},
		label: 'DNS server status',
		unit: ''
	},
	{
		oid: '1.3.6.1.2.1.31.1.1.1.6.1',
		label: 'Interface [em0()]: Bits received',
		unit: 'bps',
		postProcess: [multiply_result(8)]
	},
	{
		oid: '1.3.6.1.2.1.31.1.1.1.10.1',
		label: 'Interface [em0()]: Bits sent',
		unit: 'bps',
		postProcess: [multiply_result(8)]
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.12',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv4 packets blocked',
		unit: 'pps',
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.11',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv4 packets passed',
		unit: 'pps',
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.8',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv4 traffic blocked',
		unit: 'bps',
		postProcess: [multiply_result(8)]
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.7',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv4 traffic passed',
		unit: 'bps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.20',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv6 packets blocked',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.19',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv6 packets passed',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.16',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv6 traffic blocked',
		unit: 'bps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.15',
			callback: update_oid
		},
		label: 'Interface [em0()]: Inbound IPv6 traffic passed',
		unit: 'bps'
	},
	{
		oid: '1.3.6.1.2.1.2.2.1.13.1',
		label: 'Interface [em0()]: Inbound packets discarded',
		unit: ''
	},
	{
		oid: '1.3.6.1.2.1.2.2.1.14.1',
		label: 'Interface [em0()]: Inbound packets with errors',
		unit: ''
	},
	{
		oid: '1.3.6.1.2.1.2.2.1.3.1',
		label: 'Interface [em0()]: Interface type',
		unit: ''
	},
	{
		oid: '1.3.6.1.2.1.2.2.1.8.1',
		label: 'Interface [em0()]: Operational status',
		unit: ''
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.14',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv4 packets blocked',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.13',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv4 packets passed',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.10',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv4 traffic blocked',
		unit: 'bps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.9',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv4 traffic passed',
		unit: 'bps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.22',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv6 packets blocked',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.21',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv6 packets passed',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.18',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv6 traffic blocked',
		unit: 'bps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.17',
			callback: update_oid
		},
		label: 'Interface [em0()]: Outbound IPv6 traffic passed',
		unit: 'bps'
	},
	{
		oid: '1.3.6.1.2.1.2.2.1.19.1',
		label: 'Interface [em0()]: Outbound packets discarded',
		unit: ''
	},
	{
		oid: '1.3.6.1.2.1.2.2.1.20.1',
		label: 'Interface [em0()]: Outbound packets with errors',
		unit: ''
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.6',
			callback: update_oid
		},
		label: 'Interface [em0()]: Rules references count',
		unit: ''
	},
	{
		oid: '1.3.6.1.2.1.31.1.1.1.15.1',
		label: 'Interface [em0()]: Speed',
		unit: 'bps'
	},
	{
		oid: '1.3.6.1.2.1.31.1.1.1.6.2',
		label: 'Interface [em1()]: Bits received',
		unit: 'bps'
	},
	{
		oid: '1.3.6.1.2.1.31.1.1.1.10.2',
		label: 'Interface [em1()]: Bits sent',
		unit: 'bps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.12',
			callback: update_oid
		},
		label: 'Interface [em1()]: Inbound IPv4 packets blocked',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.11',
			callback: update_oid
		},
		label: 'Interface [em1()]: Inbound IPv4 packets passed',
		unit: 'pps'
	},
	{
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em0', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.8',
			callback: update_oid
		},
		label: 'Interface [em1()]: Inbound IPv4 traffic blocked',
		unit: 'bps'
	},
	{
		label: 'Interface [em1()]: Inbound IPv4 traffic passed',
		unit: 'bps',
		walk: { ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em1', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.7', callback: update_oid }
	},
	{
		label: 'Interface [em1()]: Inbound IPv6 packets blocked',
		unit: 'pps',
		walk: { ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em1', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.20', callback: update_oid }
	},
	{
		label: 'Interface [em1()]: Inbound IPv6 packets passed',
		unit: 'pps',
		walk: { ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em1', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.19', callback: update_oid }
	},
	{
		label: 'Interface [em1()]: Inbound IPv6 traffic blocked',
		unit: 'bps',
		walk: { ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em1', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.16', callback: update_oid }
	},
	{
		label: 'Interface [em1()]: Inbound IPv6 traffic passed',
		unit: 'bps',
		walk: { ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2', name: 'em1', oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.15', callback: update_oid }
	},
	{
		label: 'Interface [em1()]: Inbound packets discarded',
		unit: '', oid: '1.3.6.1.2.1.2.2.1.13.2'
	},
	{
		label: 'Interface [em1()]: Inbound packets with errors',
		unit: '', oid: '1.3.6.1.2.1.2.2.1.14.2'
	},
	{
		label: 'Interface [em1()]: Interface type',
		unit: '', oid: '1.3.6.1.2.1.2.2.1.3.2'
	},
	{
		label: 'Interface [em1()]: Operational status',
		unit: '', oid: '1.3.6.1.2.1.2.2.1.8.2'
	},
	{
		label: 'Interface [em1()]: Outbound IPv4 packets blocked',
		unit: 'pps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.14',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound IPv4 packets passed',
		unit: 'pps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.13',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound IPv4 traffic blocked',
		unit: 'bps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.10',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound IPv4 traffic passed',
		unit: 'bps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.9',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound IPv6 packets blocked',
		unit: 'pps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.22',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound IPv6 packets passed',
		unit: 'pps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.21',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound IPv6 traffic blocked',
		unit: 'bps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.18',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound IPv6 traffic passed',
		unit: 'bps',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.17',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Outbound packets discarded',
		unit: '',
		oid: '1.3.6.1.2.1.2.2.1.19.2'
	},
	{
		label: 'Interface [em1()]: Outbound packets with errors',
		unit: '',
		oid: '1.3.6.1.2.1.2.2.1.20.2'
	},
	{
		label: 'Interface [em1()]: Rules references count',
		unit: '',
		walk: {
			ref: '1.3.6.1.4.1.12325.1.200.1.8.2.1.2',
			name: 'em1',
			oid: '1.3.6.1.4.1.12325.1.200.1.8.2.1.6',
			callback: update_oid
		}
	},
	{
		label: 'Interface [em1()]: Speed',
		unit: 'Mbps',
		oid: '1.3.6.1.2.1.31.1.1.1.15.2'
	},
	{
		label: 'Interrupts per second',
		unit: '',
		oid: '1.3.6.1.4.1.2021.11.59.0',
	},
	{
		label: 'Load average (1m avg)',
		unit: '',
		walk: {
			ref: '1.3.6.1.4.1.2021.10.1.2',
			name: 'Load-1',
			oid: '1.3.6.1.4.1.2021.10.1.3',
			callback: update_oid
		}
	},
	{
		label: 'Load average (5m avg)',
		unit: '',
		walk: {
			ref: '1.3.6.1.4.1.2021.10.1.2',
			name: 'Load-5',
			oid: '1.3.6.1.4.1.2021.10.1.3',
			callback: update_oid
		}
	},
	{
		label: 'Load average (15m avg)',
		unit: '',
		walk: {
			ref: '1.3.6.1.4.1.2021.10.1.2',
			name: 'Load-15',
			oid: '1.3.6.1.4.1.2021.10.1.3',
			callback: update_oid
		}
	},
	{
		label: 'Normalized packets',
		unit: 'pps',
		oid: '1.3.6.1.4.1.12325.1.200.1.2.5.0'
	},
	{
		label: 'Packet filter running status',
		unit: '',
		oid: '1.3.6.1.4.1.12325.1.200.1.1.1.0'
	},
	{
		label: 'Packets dropped due to memory limitation',
		unit: 'pps',
		oid: '1.3.6.1.4.1.12325.1.200.1.2.6.0'
	},
	{
		label: 'Packets matched a filter rule',
		unit: 'pps',
		oid: '1.3.6.1.4.1.12325.1.200.1.2.1.0'
	},
	{
		label: 'Packets with bad offset',
		unit: 'pps',
		oid: '1.3.6.1.4.1.12325.1.200.1.2.2.0'
	},
	{
		label: 'Short packets',
		unit: 'pps',
		oid: '1.3.6.1.4.1.12325.1.200.1.2.4.0'
	},
	{
		label: 'Source tracking table current',
		unit: '',
		oid: '1.3.6.1.4.1.12325.1.200.1.4.1.0',
		order: 0
	},
	{
		label: 'Source tracking table limit',
		unit: '',
		oid: '1.3.6.1.4.1.12325.1.200.1.5.2.0',
		order: 0
	},
	{
		label: 'Source tracking table utilization',
		unit: '%',
		oid: '__calculated_tracking_table_usage',
		postProcess: [function (last, next) {
			var count = get_result('1.3.6.1.4.1.12325.1.200.1.4.1.0');
			var limit = get_result('1.3.6.1.4.1.12325.1.200.1.5.2.0');
			this.result = (count * 100) / limit;
			next(this);
		}],
		snmpget: false
	},
	{
		label: 'State of nginx process',
		unit: '',
		walk: {
			ref: '1.3.6.1.2.1.25.4.2.1.2',
			name: 'nginx',
			oid: '1.3.6.1.2.1.25.4.2.1.7',
			callback: update_oid
		}
	},
	{
		label: 'States table current',
		unit: '',
		oid: '1.3.6.1.4.1.12325.1.200.1.3.1.0',
		order: 0
	},
	{
		label: 'States table limit',
		unit: '',
		oid: '1.3.6.1.4.1.12325.1.200.1.5.1.0',
		order: 0
	},
	{
		label: 'States table utilization',
		unit: '%',
		oid: '__calculated_states_table_usage',
		postProcess: [function (last, next) {
			var count = get_result('1.3.6.1.4.1.12325.1.200.1.3.1.0');
			var limit = get_result('1.3.6.1.4.1.12325.1.200.1.5.1.0');
			this.result = (count * 100) / limit;
			next(this);
		}],
		snmpget: false
	},
	{
		label: 'System contact details',
		unit: '',
		oid: '1.3.6.1.2.1.1.4.0'
	},
	{
		label: 'System description',
		unit: '',
		oid: '1.3.6.1.2.1.1.1.0'
	},
	{
		label: 'System location',
		unit: '',
		oid: '1.3.6.1.2.1.1.6.0'
	},
	{
		label: 'System name',
		unit: '',
		oid: '1.3.6.1.2.1.1.5.0'
	},
	{
		label: 'System object ID',
		unit: '',
		oid: '1.3.6.1.2.1.1.2.0'
	},
	{
		'label': 'Uptime',
		'unit': 'uptime',
		'oid': '1.3.6.1.2.1.25.1.1.0'
	},
];

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

function get_result(oid) {
	return snmp_parameters.filter(function (p) {
		return p.oid == oid;
	}).map(function (p) {
		return p.result;
	})[0];
}

function update_oid(param, res) {
	for (var key in res) {
		if (res[key] == param.walk.name) {
			var oidArray = key.split('.');
			var index = oidArray[oidArray.length - 1];
			param.oid = param.walk.oid + '.' + index;
			break;
		}
	}
}

function change_per_second(last, next) {
	var old_time = this.first_execution_date;
	var old_value = this.result;
	var _this = this;
	setTimeout(function () {
		var new_time = new Date();
		createSNMPSession().get([_this.oid], function (result, error) {
			if (error) {
				console.error(error);
				D.failure(D.errorType.GENERIC_ERROR);
			}
			var new_value = result[_this.oid];
			var time_diff = (new_time - old_time) / 1000;
			_this.result = (new_value - old_value) / time_diff;
			next(_this);
		});
	}, 5000);
}

function divide_by_cpu_count(last, next) {
	var nCPU = get_result('1.3.6.1.2.1.25.3.3.1.2.cpus');
	this.result = this.result / nCPU;
	next(this);
}

function multiply_result(number) {
	return function (last, next) {
		this.result = this.result * number;
		next(this);
	};
}




function preprocess_params(cb) {
	var arrayFn = [];
	snmp_parameters.forEach(function (p) {
		if (p.walk) {
			arrayFn.push(function (callback) {
				createSNMPSession().walk(p.walk.ref, function (result, error) {
					p.walk.callback(p, result);
					callback(p);
				});
			});

		}
	});

	execute_all(arrayFn, function (result) {
		cb();
	});
}


function generate_variable(p, result, first_execution_date, callback) {
	if (p.unit) {
		p.label += ' (' + p.unit + ')';
	}
	if(result[p.oid]){
		p.result = result[p.oid];
	}
	if (p.convert && typeof (p.convert) == 'function') {
		p.result = p.convert();
	}
	p.uid = p.oid;
	if (!p.uid) {
		p.uid = p.walk.ref + '.' + p.walk.name;
	}
	p.first_execution_date = first_execution_date;
	if (p.postProcess && p.postProcess.length) {
		console.log('Postprocessing ' + p.label);
		return execute_seq.apply(p, [p.postProcess, function (result) {
			console.log('Postprocessing done ' + p.label);
			callback(p);
		}]);
	}
	callback(p);
}

function execute_get(param) {
	return function (callback) {
		// console.log("excuting for parameter: " + param.label)
		function run() {
			if (param.oid && param.snmpget !== false) {
				createSNMPSession().get([param.oid], function (result, error) {
					if (error) {
						console.error(error);
						D.failure(D.errorType.GENERIC_ERROR);
					}

					generate_variable(param, result, new Date(), function (variable) {
						callback(variable);
					});

				});
			} else {
				generate_variable(param, {}, new Date(), function (variable) {
					callback(variable);
				});
			}
		}
		if (param.preProcess && param.preProcess.length) {
			console.log('Preprocessing ' + param.label);
			return execute_seq.apply(param, [param.preProcess, function () {
				console.log('Preprocessing done ' + param.label);
				run();
			}]);
		} else {
			run();
		}

	};
}



/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
	createSNMPSession().get(['1.3.6.1.4.1.12325.1.200.1.2.1.0'], function (result, error) {
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
	var order_groups = [];
	var orders = snmp_parameters
		.filter(function (p) { return p.order != null; })
		.map(function (p) { return p.order; })
		.reduce(function (a, b) {
			if (a.indexOf(b) < 0) a.push(b);
			return a;
		}, []).sort();

	orders.forEach(function (order) {
		var group = snmp_parameters.filter(function (p) { return p.order == order; });
		order_groups.push(group);
	});
	var final_group = snmp_parameters.filter(function (p) { return p.order == null; });
	order_groups.push(final_group);

	var ordred_fns = order_groups.map(function (params) {
		var fns = params.map(function (p) {
			return execute_get(p);
		});
		return function (last, next) {
			execute_all(fns, next);
		};
	});
	preprocess_params(function () {
		execute_seq(ordred_fns, function () {
			var result = snmp_parameters.map(function (p) {
				return _var(p.uid, p.label, '' + p.result, p.unit);
			});
			D.success(result);
		});
	});
}
