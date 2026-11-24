// Simulated Lenovo XClarity Controller (XCC) 8.42 reply to `syshealth power`. Shape is a best reconstruction from
// what the driver skips (a title/header line pair) and reads (a three-word name "Power Supply 1", then the health
// word and the rated power in watts); Lenovo does not publish a verbatim sample. No footer line is printed after
// the last row (sendSSHCommand trims trailing blank lines).
const reply = require("../../replies");

const POWER = [
    "Power Supplies",
    "Name           Status    Rated Power(W)",
    "Power Supply 1 Normal    750",
    "Power Supply 2 Critical  750",
    "Power Supply 3 Normal    1100",
    ""
].join("\n");

function calls() {
    return [{ kind: "ssh", method: "sendSSHCommand", target: "syshealth power", reply: reply.ssh(POWER) }];
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
