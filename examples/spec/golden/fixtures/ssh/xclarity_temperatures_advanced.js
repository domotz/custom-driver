// Simulated Lenovo XClarity Controller (XCC) 8.42 reply to `temps`. Shape is a best reconstruction from what the
// driver skips (a title line, a blank line and a header line) and reads (a multi-word sensor name followed by the
// five last columns: warning reset, warning, "F/C" reading, soft shutdown, hard shutdown); Lenovo does not publish a
// verbatim sample. Two sensors have a reading above their warning threshold. No prompt line is printed after the last
// row (sendSSHCommand trims trailing blank lines).
const reply = require("../../replies");

const TEMPS = [
    "Temperatures are displayed in degrees Fahrenheit/Celsius",
    "",
    "Name            WR      W       Temp    SS      HS",
    "CPU1 Temp       75/24   88/31   72/22   95/35   100/38",
    "CPU2 Temp       75/24   88/31   93/34   95/35   100/38",
    "Ambient Temp    60/16   108/42  75/24   113/45  118/48",
    "DIMM 1 Temp     70/21   90/32   81/27   95/35   100/38",
    ""
].join("\n");

function calls() {
    return [{ kind: "ssh", method: "sendSSHCommand", target: "temps", reply: reply.ssh(TEMPS) }];
}

module.exports = {
    cases: [{
        name: "xcc 8.42",
        entryPoints: {
            validate: { calls: calls() },
            // companion declares expected_variables.independent [5,999] but the driver reports a table (reported as a companion bug)
            get_status: { calls: calls(), expect: { skipExpectedVariables: true } }
        }
    }]
};
