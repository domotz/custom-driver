// Simulated Windows Server 2019 / PowerShell 5.1 over OpenSSH. Shape follows the command's pipeline: one "Name#Status#DisplayName"
// line per service (the driver builds the string itself). With no exclusion or monitored list, every service is printed.
const reply = require("../../replies");

const COMMAND = "powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName}\"";

const OUTPUT = [
    "AJRouter#Stopped#AllJoyn Router Service",
    "BITS#Running#Background Intelligent Transfer Service",
    "Dhcp#Running#DHCP Client",
    "Dnscache#Running#DNS Client",
    "EventLog#Running#Windows Event Log",
    "Spooler#Stopped#Print Spooler",
    "W32Time#Running#Windows Time",
    "wuauserv#Stopped#Windows Update",
    ""
].join("\r\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(OUTPUT) });

module.exports = {
    cases: [{
        name: "server 2019",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
