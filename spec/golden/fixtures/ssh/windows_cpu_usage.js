// Simulated Windows Server 2019 / PowerShell 5.1 over OpenSSH. Shape follows the default table view of
// `Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select Average`: blank line, "Average"
// header, dashes, the value (right aligned), blank lines; sendSSHCommand's trim drops the leading blank line.
const reply = require("../../replies");

const COMMAND = 'powershell -command "Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select Average"';

const output = (value) => ["", "Average", "-------", ("        " + value).slice(-7), "", ""].join("\r\n");
const call = (value) => ({ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(output(value)) });

module.exports = {
    cases: [
        { name: "server 2019, moderate load", entryPoints: { validate: { calls: [call(23)] }, get_status: { calls: [call(23)] } } },
        { name: "server 2019, saturated", entryPoints: { validate: { calls: [call(97)] }, get_status: { calls: [call(97)] } } }
    ]
};
