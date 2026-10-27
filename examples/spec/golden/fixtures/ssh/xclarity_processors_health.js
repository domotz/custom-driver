// Simulated Lenovo XClarity Controller (XCC) 8.42 reply to `syshealth processors`. Shape is a best reconstruction from
// what the driver skips (a title/header line pair) and reads (a two-word FRU name "CPU 1", then the health word and the
// clock speed in MHz); Lenovo does not publish a verbatim sample. No footer line is printed after the last row
// (sendSSHCommand trims trailing blank lines).
const reply = require("../../replies");

const PROCESSORS = [
    "Processors Health",
    "FRU Name  Health    Clock(MHz)",
    "CPU 1     Normal    2400",
    "CPU 2     Critical  2100",
    ""
].join("\n");

function calls() {
    return [{ kind: "ssh", method: "sendSSHCommand", target: "syshealth processors", reply: reply.ssh(PROCESSORS) }];
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
