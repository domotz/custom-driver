// Simulated Windows Server 2019 / PowerShell 5.1 replies. Shape follows the default table view of
// `Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select Average`:
// blank line, "Average" header, dashes, the value, blank lines. The SSH mode runs the same through `powershell -Command`.
const reply = require("../../replies");

const COMMAND = "Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select Average";
const SSH_COMMAND = 'powershell -Command "' + COMMAND + '"';

const OUTPUT = [
    "",
    "Average",
    "-------",
    "     23",
    "",
    ""
].join("\r\n");

module.exports = {
    cases: [{
        name: "winrm, server 2019",
        parameters: { protocol: "winrm" },
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(OUTPUT) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(OUTPUT) }] }
        }
    }, {
        name: "ssh, server 2019",
        parameters: { protocol: "ssh" },
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: SSH_COMMAND, reply: reply.ssh(OUTPUT) }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: SSH_COMMAND, reply: reply.ssh(OUTPUT) }] }
        }
    }]
};
