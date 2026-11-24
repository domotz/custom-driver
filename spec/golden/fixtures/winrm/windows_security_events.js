// Simulated Windows Server 2019 (PowerShell 5.1) replies. Shape follows `Get-WinEvent ... | group id | select name,count |
// ConvertTo-Json` (5.1: 4-space indent, "Name" is the event id as a string, "Count" a number; a single group is a bare
// object) and the default Get-WinEvent table for the validate probe. The SSH case runs the same commands through
// `powershell -Command "..."` (sendSSHCommand output, trimmed).
const reply = require("../../replies");

const VALIDATE = 'Get-winevent -Logname "Security" -Maxevents 1;';
const GET_STATUS = "$Hours=1;$events=Get-WinEvent -FilterHashTable @{LogName=\"Security\";ID=4625,4649,4720,4722,4731,4732,4741,4817,4947,4948;StartTime=((Get-Date).AddHours(-($Hours)));EndTime=(Get-Date)} -ErrorAction SilentlyContinue |group id|select name,count;if ($events){$events | ConvertTo-Json} else {@{name=\"\";count=\"0\"}|ConvertTo-Json};";

const EVENT = [
    "",
    "   ProviderName: Microsoft-Windows-Security-Auditing",
    "",
    "TimeCreated                     Id LevelDisplayName Message",
    "-----------                     -- ---------------- -------",
    "1/15/2026 9:58:01 AM          4624 Information      An account was successfully logged on....",
    ""
].join("\r\n");

const MANY = [{ Name: "4625", Count: 14 }, { Name: "4732", Count: 2 }, { Name: "4720", Count: 1 }];
const ONE = { Name: "4625", Count: 3 };

const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
const winrmCall = (target, out) => ({ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(out) });
const sshCall = (target, out) => ({ kind: "ssh", method: "sendSSHCommand", target: ssh(target), reply: reply.ssh(out) });
const json = (value) => JSON.stringify(value, null, 4) + "\r\n";

module.exports = {
    cases: [{
        name: "winrm, three event ids seen",
        parameters: { protocol: "WINRM" },
        entryPoints: {
            validate: { calls: [winrmCall(VALIDATE, EVENT)] },
            get_status: { calls: [winrmCall(GET_STATUS, json(MANY))] }
        }
    }, {
        name: "winrm, a single event id is a bare object",
        parameters: { protocol: "WINRM" },
        entryPoints: {
            validate: { calls: [winrmCall(VALIDATE, EVENT)] },
            get_status: { calls: [winrmCall(GET_STATUS, json(ONE))] }
        }
    }, {
        name: "ssh, three event ids seen",
        parameters: { protocol: "SSH" },
        entryPoints: {
            validate: { calls: [sshCall(VALIDATE, EVENT)] },
            get_status: { calls: [sshCall(GET_STATUS, json(MANY))] }
        }
    }]
};
