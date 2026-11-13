// Simulated Lenovo XClarity Controller (XCC) 8.42 replies. Shape follows the XCC CLI `syshealth storage`
// output: a title, a column header and a separator, then one "<FRU name>  <health>" row per drive, a blank
// line, and a Flash DIMMs section. Layout is a best reconstruction from what the driver skips (3 header
// lines, trailing Flash DIMMs block); Lenovo does not publish a verbatim sample.
const reply = require("../../replies");

const STORAGE = [
    "Local Storage Health",
    "FRU Name              Health",
    "---------------------------",
    "Drive 0               Normal",
    "Drive 1               Normal",
    "Drive 2               Critical",
    "",
    "Flash DIMMs",
    "FRU Name              Health",
    "---------------------------",
    "Flash DIMM 1          Normal",
    ""
].join("\n");

function calls() {
    return [{ kind: "ssh", method: "sendSSHCommand", target: "syshealth storage", reply: reply.ssh(STORAGE) }];
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
