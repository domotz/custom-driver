// Simulated Windows Server 2019 (PowerShell 5.1) replies. Shape follows `ConvertTo-Json` (5.1) of the hashtables
// { category; subcat; setting } the command builds from `auditpol /get /category:*` (setting is one of
// "No Auditing", "Success", "Failure", "Success and Failure"; the command keeps only the monitored subcategories)
// and the default Get-WinEvent table for the validate probe. The SSH case runs the same commands through
// `powershell -Command "..."` (sendSSHCommand output, trimmed).
const reply = require("../../replies");

const VALIDATE = 'Get-WinEvent -LogName "Security" -MaxEvents 1';
const FILTER = '@("Security System Extension","Logon","SAM","Audit Policy Change","Authentication Policy Change","MPSSVC Rule-Level Policy Change","Computer Account Management","Security Group Management","User Account Management","Directory Service Changes","Directory Service Replication")';
const GET_STATUS = "$output = auditpol /get /category:* | Where-Object { $_ -match '\\S' };$output = $output -replace '(?<=\\S)\\s{2,}(?=\\S)', ',';$aOutput = $output -split '\\r?\\n';$aOutput = $aOutput[2..($aOutput.Length - 1)];$CurrCategory = '';$RetObj = [System.Collections.ArrayList]::new();foreach ($item in $aOutput){if ($item -match '^\\s'){$tobj = @{category = $CurrCategory;subcat = (($item.split(','))[0]).Trim();setting = ($item.split(','))[1]};$RetObj += $tobj}elseif ($item -match '^(\\S)') {$CurrCategory = $item}};$RetObj |?{" + FILTER + " -contains $_.subcat}|ConvertTo-Json";

const EVENT = [
    "",
    "   ProviderName: Microsoft-Windows-Security-Auditing",
    "",
    "TimeCreated                     Id LevelDisplayName Message",
    "-----------                     -- ---------------- -------",
    "1/15/2026 9:58:01 AM          4624 Information      An account was successfully logged on....",
    ""
].join("\r\n");

const ROWS = [
    ["System", "Security System Extension", "No Auditing"],
    ["Logon/Logoff", "Logon", "Success and Failure"],
    ["Object Access", "SAM", "No Auditing"],
    ["Policy Change", "Audit Policy Change", "Success"],
    ["Policy Change", "Authentication Policy Change", "Success"],
    ["Policy Change", "MPSSVC Rule-Level Policy Change", "No Auditing"],
    ["Account Management", "Computer Account Management", "Success"],
    ["Account Management", "Security Group Management", "Success and Failure"],
    ["Account Management", "User Account Management", "Success and Failure"],
    ["DS Access", "Directory Service Changes", "Failure"],
    ["DS Access", "Directory Service Replication", "No Auditing"]
].map((r) => ({ category: r[0], subcat: r[1], setting: r[2] }));

const OUT = JSON.stringify(ROWS, null, 4) + "\r\n";

const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
const winrmCall = (target, out) => ({ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(out) });
const sshCall = (target, out) => ({ kind: "ssh", method: "sendSSHCommand", target: ssh(target), reply: reply.ssh(out) });

module.exports = {
    cases: [{
        name: "winrm, eleven monitored subcategories",
        parameters: { protocol: "WINRM" },
        entryPoints: {
            validate: { calls: [winrmCall(VALIDATE, EVENT)] },
            get_status: { calls: [winrmCall(GET_STATUS, OUT)] }
        }
    }, {
        name: "ssh, eleven monitored subcategories",
        parameters: { protocol: "SSH" },
        entryPoints: {
            validate: { calls: [sshCall(VALIDATE, EVENT)] },
            get_status: { calls: [sshCall(GET_STATUS, OUT)] }
        }
    }]
};
