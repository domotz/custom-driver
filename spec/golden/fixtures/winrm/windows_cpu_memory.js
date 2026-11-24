// Simulated Windows 11 / PowerShell 5.1 replies. Shape follows ConvertTo-Json -Compress of a hashtable:
// compact JSON, a single CPU is a bare object (not an array), Win32_OperatingSystem.FreePhysicalMemory is in KiB,
// Win32_PhysicalMemory capacity in bytes. The SSH mode runs the same script through `powershell -Command`.
const reply = require("../../replies");

const TOTAL_MEMORY = "(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).Sum";
const AVAILABLE_MEMORY = "Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory";
const CPU_INFO = "Get-CimInstance Win32_processor | Select-Object name, MaxClockSpeed, NumberOfLogicalProcessors, NumberOfCores, Status";
const CPU_USAGE = '(Get-Counter -Counter "\\Processor(_Total)\\% Processor Time" -SampleInterval 2 -MaxSamples 5 | Select-Object -ExpandProperty countersamples | Select-Object -ExpandProperty cookedvalue | Measure-Object -Average).Average';
const COMMAND = "@{ TotalMemory = " + TOTAL_MEMORY + "; AvailableMemory = " + AVAILABLE_MEMORY + "; CPUInfo = " + CPU_INFO + "; Average = " + CPU_USAGE + "} | ConvertTo-Json -Compress";
const SSH_COMMAND = 'powershell -Command "' + COMMAND.replace(/"/g, '\\"') + '"';

const OUTPUT = JSON.stringify({
    CPUInfo: { name: "12th Gen Intel(R) Core(TM) i7-1255U", MaxClockSpeed: 1700, NumberOfLogicalProcessors: 12, NumberOfCores: 10, Status: "OK" },
    TotalMemory: 17179869184,
    AvailableMemory: 6815744,
    Average: 14.368421052631579
}) + "\r\n";

module.exports = {
    cases: [{
        name: "winrm, windows 11",
        parameters: { protocol: "winrm" },
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(OUTPUT) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(OUTPUT) }] }
        }
    }, {
        name: "ssh, windows 11",
        parameters: { protocol: "ssh" },
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: SSH_COMMAND, reply: reply.ssh(OUTPUT) }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: SSH_COMMAND, reply: reply.ssh(OUTPUT) }] }
        }
    }]
};
