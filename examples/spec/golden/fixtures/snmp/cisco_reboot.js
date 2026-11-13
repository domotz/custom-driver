// Simulated Cisco IOS device. Shape follows OLD-CISCO-TS-MIB: tsMsgSend (1.3.6.1.4.1.9.2.9.9.0) is an Integer
// {nothing(1), reload(2), messagedone(3), abort(4)}; sysUpTime (1.3.6.1.2.1.1.3.0) is TimeTicks (hundredths of
// a second), which the sandbox delivers as a numeric string. A successful set echoes the varbind.
// Uptime 100 days = 864000000 ticks.
const reply = require("../../replies");

const TS_MSG_SEND = "1.3.6.1.4.1.9.2.9.9.0";
const SYS_UPTIME = "1.3.6.1.2.1.1.3.0";

module.exports = {
    cases: [{
        name: "router up 100 days",
        entryPoints: {
            validate: {
                calls: [{ kind: "snmp", method: "get", target: TS_MSG_SEND, reply: reply.snmp({ [TS_MSG_SEND]: "1" }) }]
            },
            get_status: {
                calls: [{ kind: "snmp", method: "get", target: SYS_UPTIME, reply: reply.snmp({ [SYS_UPTIME]: "864000000" }) }]
            },
            custom_1: {
                calls: [{ kind: "snmp", method: "set", target: TS_MSG_SEND, reply: reply.snmp({ [TS_MSG_SEND]: "2" }) }]
            }
        }
    }]
};
