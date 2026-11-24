// Simulated Veeam Backup & Replication 12 / PowerShell 5.1 replies. Shape follows the script's own output line,
// `"{0},{1},{2},{3},{4}" -f VM, Status, Job, StartTime, EndTime`, with the TaskSession status of Get-VBRBackupSession
// (Success, Warning, Failed) and the dates in the DD/MM/YYYY HH:MM:SS form the script parses (the -f operator uses the
// server's culture, en-GB here). Newest session first, as `Sort-Object EndTime -Descending` returns them.
// validate gets the default list view of Get-VBRBackupSession. The server is the external device `veeamServerIP`.
const reply = require("../../replies");

const HOST = "10.0.0.50";
const IMPORT = "Import-Module Veeam.Backup.PowerShell -WarningAction SilentlyContinue; ";
const VALIDATE = IMPORT + "Get-VBRBackupSession | Select-Object -First 1";
const fetch = (n) => IMPORT + 'Get-VBRBackupSession | Sort-Object EndTime -Descending | ForEach-Object { $session = $_; $session.GetTaskSessions() | Where-Object { $_.Name -eq "dc-01" } | ForEach-Object { [PSCustomObject]@{ VM = $_.Name; Status = $_.Status; Job = $session.JobName; StartTime = $session.CreationTime; EndTime = $session.EndTime } } } | Sort-Object EndTime -Descending | Select-Object -First ' + n + ' | ForEach-Object { Write-Output ("{0},{1},{2},{3},{4}" -f $_.VM, $_.Status, $_.Job, $_.StartTime, $_.EndTime) }';
const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';

const VALIDATE_OUTPUT = [
    "",
    "JobId        : 8b5b6d2e-0a7c-4a0c-9d3f-6f3b1c2d4e5a",
    "JobName      : Backup Job dc-01",
    "JobType      : HvReplica",
    "CreationTime : 14/01/2026 22:00:04",
    "EndTime      : 14/01/2026 22:41:19",
    "Result       : Success",
    "State        : Stopped",
    "",
    ""
].join("\r\n");

// Newest first: 14/01 night ok (41 min), 13/01 night warning (1 h 07), 12/01 night failed (5 min).
const SESSIONS = [
    "dc-01,Success,Backup Job dc-01,14/01/2026 22:00:04,14/01/2026 22:41:19",
    "dc-01,Warning,Backup Job dc-01,13/01/2026 22:00:03,13/01/2026 23:07:44",
    "dc-01,Failed,Backup Job dc-01,12/01/2026 22:00:05,12/01/2026 22:05:12"
].join("\r\n") + "\r\n";

const BASE = { vmName: "dc-01", veeamServerIP: HOST, veeamServerUsername: "veeam-svc", veeamServerPassword: "Secret1!" };
const winrm = (target, stdout) => ({ kind: "winrm", method: "sendWinRMCommand", host: HOST, target, reply: reply.winrm(stdout) });
const sshCall = (target, stdout) => ({ kind: "ssh", method: "sendSSHCommand", host: HOST, target: ssh(target), reply: reply.ssh(stdout) });

module.exports = {
    cases: [{
        name: "winrm, three sessions, default count",
        parameters: Object.assign({ protocol: "winrm" }, BASE),
        entryPoints: {
            validate: { calls: [winrm(VALIDATE, VALIDATE_OUTPUT)] },
            get_status: { calls: [winrm(fetch(100), SESSIONS)] }
        }
    }, {
        name: "winrm, latest session only",
        parameters: Object.assign({ protocol: "winrm", numberOfResults: "1" }, BASE),
        entryPoints: {
            validate: { calls: [winrm(VALIDATE, VALIDATE_OUTPUT)] },
            get_status: { calls: [winrm(fetch(2), SESSIONS.split("\r\n").slice(0, 2).join("\r\n") + "\r\n")] }
        }
    }, {
        name: "ssh, three sessions",
        parameters: Object.assign({ protocol: "ssh" }, BASE),
        entryPoints: {
            validate: { calls: [sshCall(VALIDATE, VALIDATE_OUTPUT)] },
            get_status: { calls: [sshCall(fetch(100), SESSIONS)] }
        }
    }]
};
