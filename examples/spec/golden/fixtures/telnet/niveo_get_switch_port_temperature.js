// Simulated Niveo managed switch CLI session over telnet (the sandbox does the Username:/Password: login; the reply is
// the command output, whose lines end with "\n\r" as the driver splits on). The command help `thermal status ?`
// mentions "chip temperature"; `thermal status` prints one line per port: port number, temperature, unit C or F.
// The exact Niveo CLI text is not public: lines follow what the driver's regular expression expects
// (<port> <temperature> <C|F>). Port 5 is running hot, port 9 reports in Fahrenheit.
const reply = require("../../replies");

const HELP = "thermal status ?\n\r  <cr>  Display chip temperature of each port\n\r:/>";

const STATUS = [
    "thermal status",
    "Port  Temperature  Unit  State",
    "  1        41        C    normal",
    "  2        43        C    normal",
    "  5        78        C    high",
    "  9       109        F    normal",
    "  10       0         C    normal",
    ":/>"
].join("\n\r");

module.exports = {
    cases: [{
        name: "niveo five ports",
        entryPoints: {
            validate: { calls: [{ kind: "telnet", method: "sendTelnetCommand", target: "thermal status ?", reply: reply.telnet(HELP) }] },
            get_status: { calls: [{ kind: "telnet", method: "sendTelnetCommand", target: "thermal status", reply: reply.telnet(STATUS) }] }
        }
    }]
};
