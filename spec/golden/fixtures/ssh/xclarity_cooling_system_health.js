// Simulated Lenovo XClarity Controller (XCC) 8.42 reply to `syshealth cooling`. Shape is a best reconstruction from
// what the driver skips (a title/header line pair) and reads (a three-word fan name such as "Fan 1A Tach", then
// speed in RPM, speed in % and the health word); Lenovo does not publish a verbatim sample. No footer line is
// printed after the last row (sendSSHCommand trims trailing blank lines).
const reply = require("../../replies");

const COOLING = [
    "Cooling Devices",
    "Name         Speed(RPM) Speed(%) Status",
    "Fan 1A Tach  8160       42       Normal",
    "Fan 1B Tach  7920       41       Normal",
    "Fan 2A Tach  0          0        Critical",
    "Fan 2B Tach  8040       42       Normal",
    "Fan 3A Tach  8280       43       Normal",
    ""
].join("\n");

function calls() {
    return [{ kind: "ssh", method: "sendSSHCommand", target: "syshealth cooling", reply: reply.ssh(COOLING) }];
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
