// Simulated Windows Server 2019 (PowerShell 5.1) replies. Shape follows `Group-Object | select count, values |
// ConvertTo-Json` (5.1: "Count":  N with two spaces, "Values" an array holding the grouped TargetUserName; a single
// group is a bare object) and the default Get-WinEvent table for the validate probe. The SSH case runs the same
// commands through `powershell -Command "..."` (sendSSHCommand output, trimmed).
const reply = require("../../replies");

const HOURS = 24;
const VALIDATE = 'Get-WinEvent -LogName "Security" -MaxEvents 1';
const GET_STATUS = "$Hours=" + HOURS + ';$events=Get-WinEvent -FilterHashTable @{LogName="Security";' +
    "ID=4625;" +
    "StartTime=((Get-Date).AddHours(-($Hours)));" +
    "EndTime=(Get-Date)} -ErrorAction SilentlyContinue;" +
    "$GroupByUsers = $events | ForEach-Object {[PSCustomObject]@{TimeCreated = $_.TimeCreated;" +
    "TargetUserName = $_.properties[5].value;" +
    "WorkstationName = $_.properties[13].value;" +
    "IpAddress = $_.properties[19].value }} | Group-Object -Property TargetUserName | Sort-Object -Property Count -Descending;" +
    "if ($GroupByUsers) {Write-Output ($GroupByUsers | select count, values | ConvertTo-Json )" +
    '} else {Write-Output "[]"}';

const EVENT = [
    "",
    "   ProviderName: Microsoft-Windows-Security-Auditing",
    "",
    "TimeCreated                     Id LevelDisplayName Message",
    "-----------                     -- ---------------- -------",
    "1/15/2026 9:58:01 AM          4625 Information      An account failed to log on....",
    ""
].join("\r\n");

const ps = (group) => '    {\r\n        "Count":  ' + group[0] + ',\r\n        "Values":  [\r\n                       "' + group[1] + '"\r\n                   ]\r\n    }';
const MANY = "[\r\n" + [[17, "administrator"], [5, "jsmith"], [2, "guest"]].map(ps).join(",\r\n") + "\r\n]\r\n";
const ONE = '{\r\n    "Count":  3,\r\n    "Values":  [\r\n                   "guest"\r\n               ]\r\n}\r\n';

const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
const winrmCall = (target, out) => ({ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(out) });
const sshCall = (target, out) => ({ kind: "ssh", method: "sendSSHCommand", target: ssh(target), reply: reply.ssh(out) });

module.exports = {
    cases: [{
        name: "winrm, three accounts with failed logons",
        parameters: { hours: HOURS, protocol: "WINRM" },
        entryPoints: {
            validate: { calls: [winrmCall(VALIDATE, EVENT)] },
            get_status: { calls: [winrmCall(GET_STATUS, MANY)] }
        }
    }, {
        name: "winrm, a single account is a bare object",
        parameters: { hours: HOURS, protocol: "WINRM" },
        entryPoints: {
            validate: { calls: [winrmCall(VALIDATE, EVENT)] },
            get_status: { calls: [winrmCall(GET_STATUS, ONE)] }
        }
    }, {
        name: "ssh, three accounts with failed logons",
        parameters: { hours: HOURS, protocol: "SSH" },
        entryPoints: {
            validate: { calls: [sshCall(VALIDATE, EVENT)] },
            get_status: { calls: [sshCall(GET_STATUS, MANY)] }
        }
    }]
};
