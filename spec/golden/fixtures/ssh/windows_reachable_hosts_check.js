// Simulated Windows 10 / PowerShell 5.1 over OpenSSH. Shape follows `Test-Connection -Cn a,b,c -Quiet`, which writes
// one Boolean per computer ("True"/"False", one per line, in the order of the computer names).
const reply = require("../../replies");

const COMMAND = 'powershell -command "Test-Connection -Cn 10.0.0.1,vpn-server.corp.local,8.8.8.8 -BufferSize 16 -Count 1 -ea 0 -quiet "';
const OUTPUT = "True\r\nFalse\r\nTrue\r\n";
const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(OUTPUT) });

module.exports = {
    cases: [{
        name: "windows 10",
        parameters: { hostsToCheck: ["10.0.0.1", "vpn-server.corp.local", "8.8.8.8"] },
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
