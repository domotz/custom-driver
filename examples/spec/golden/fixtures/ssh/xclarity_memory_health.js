// Simulated Lenovo XClarity Controller (XCC) 8.42 reply to `syshealth memory`. Shape is a best reconstruction from
// what the driver skips (a title/header line pair) and reads (a two-word FRU name "DIMM 1", then the health word,
// the memory type and the capacity in GB); Lenovo does not publish a verbatim sample. No footer line is printed
// after the last row (sendSSHCommand trims trailing blank lines).
const reply = require("../../replies");

const MEMORY = [
    "Memory Health",
    "FRU Name  Health    Type  Capacity(GB)",
    "DIMM 1    Normal    DDR4  32",
    "DIMM 2    Normal    DDR4  32",
    "DIMM 3    Critical  DDR4  16",
    "DIMM 4    Normal    DDR4  64",
    ""
].join("\n");

function calls() {
    return [{ kind: "ssh", method: "sendSSHCommand", target: "syshealth memory", reply: reply.ssh(MEMORY) }];
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
