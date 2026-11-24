// Simulated Lenovo XClarity Controller (XCC) 8.42 replies. Shape follows the XCC CLI `syshealth summary`
// output as documented by Lenovo: one "<item>  <value>" line per item (Power, State, Restarts, then one
// line per component group with its health). The exact column spacing is a best reconstruction, the
// driver matches "<label>\s+<value>" per line.
const reply = require("../../replies");

const SUMMARY = [
    "Power              On",
    "State              OS booted",
    "Restarts           71",
    "Cooling Devices    Normal",
    "Local Storage      Warning",
    "Processors         Normal",
    "Memory             Normal",
    "System             Warning",
    ""
].join("\n");

function calls() {
    return [{ kind: "ssh", method: "sendSSHCommand", target: "syshealth summary", reply: reply.ssh(SUMMARY) }];
}

module.exports = {
    cases: [{
        name: "xcc 8.42",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
