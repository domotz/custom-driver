// Simulated Crestron TSW-1060 (firmware 3.x, Crestron console over SSH) replies. Shape follows the console
// commands the driver sends: `temperature` prints one "<sensor> Temperature: <n>C" line per sensor and `info`
// prints "<label>: <value>" lines. Exact wording of the console output is not published by Crestron, so labels
// are simulated from what the driver parses (names containing Temperature, Web, FTP, SSL, RConsole, System).
const reply = require("../../replies");

const TEMPERATURE = [
    "Mainboard Temperature: 44C",
    "Panel Temperature: 39C",
    "Processor Temperature: 52C",
    ""
].join("\r\n");

const INFO = [
    "Host Name: TSW-1060-00107F8A1C2D",
    "Model: TSW-1060",
    "Serial Number: 1923456",
    "Firmware Version: 3.002.1061",
    "Web Server: Enabled",
    "FTP Server: Disabled",
    "SSL: Enabled",
    "RConsole: Enabled",
    "System Uptime: 12 days 03:14:07",
    "Display Brightness: 80",
    ""
].join("\r\n");

module.exports = {
    cases: [{
        name: "tsw-1060",
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "temperature", reply: reply.ssh(TEMPERATURE) }] },
            get_status: {
                calls: [
                    { kind: "ssh", method: "sendSSHCommand", target: "temperature", reply: reply.ssh(TEMPERATURE) },
                    { kind: "ssh", method: "sendSSHCommand", target: "info", reply: reply.ssh(INFO) }
                ]
            },
            custom_1: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "reboot", reply: reply.ssh("Rebooting...\r\n") }] }
        }
    }]
};
