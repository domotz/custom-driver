// Simulated Windows 11 / PowerShell 5.1 replies. Shape follows ConvertTo-Json -Compress of a hashtable holding
// Win32_OperatingSystem and Win32_BIOS instances (BuildNumber and the serial numbers are strings in CIM).
// The SSH mode runs the same script through `powershell -Command`.
const reply = require("../../replies");

const OS_INFO = "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Manufacturer,Version,BuildNumber,OSArchitecture, SerialNumber";
const BIOS_INFO = "Get-CimInstance Win32_BIOS -erroraction 'silentlycontinue' | Select-Object SerialNumber";
const COMMAND = "@{ OperatingSystem = " + OS_INFO + "; BIOS = " + BIOS_INFO + "} | ConvertTo-Json -Compress";
const SSH_COMMAND = 'powershell -Command "' + COMMAND.replace(/"/g, '\\"') + '"';

const OUTPUT = JSON.stringify({
    OperatingSystem: {
        Caption: "Microsoft Windows 11 Pro",
        Manufacturer: "Microsoft Corporation",
        Version: "10.0.22631",
        BuildNumber: "22631",
        OSArchitecture: "64-bit",
        SerialNumber: "00330-80000-00000-AA123"
    },
    BIOS: { SerialNumber: "PF3ABC12" }
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
