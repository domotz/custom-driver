// Simulated switch answering Q-BRIDGE-MIB (RFC 4363) dot1qVlanStaticName (1.3.6.1.2.1.17.7.1.4.3.1.1):
// one row per configured VLAN, the row index is the VLAN id, the value its name. The sandbox walk returns
// OID -> string, in OID order.
const reply = require("../../replies");

const NAME = "1.3.6.1.2.1.17.7.1.4.3.1.1";
const walk = {};
walk[NAME + ".1"] = "default";
walk[NAME + ".10"] = "Users";
walk[NAME + ".20"] = "Voice";
walk[NAME + ".100"] = "Management";
walk[NAME + ".4094"] = "Quarantine";

const calls = [{ kind: "snmp", method: "walk", target: NAME, reply: reply.snmp(walk) }];

module.exports = {
    cases: [{
        name: "five static VLANs",
        entryPoints: {
            validate: { calls },
            get_status: { calls }
        }
    }]
};
