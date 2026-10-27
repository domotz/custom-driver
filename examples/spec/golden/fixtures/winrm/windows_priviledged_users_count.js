// Simulated Windows Server 2019 domain controller (PowerShell 5.1) replies. Shape follows ConvertTo-Json (5.1) of the
// [PSCustomObject]@{Name; MemberCount} list the command builds (two or more groups give an array, one group gives a
// bare object) and Get-ADUser's default property list for the validate probe.
const reply = require("../../replies");

const GET_STATUS = "$Domain = (Get-ADDomain).DNSRoot;$DC=$false;if ($(Get-SmbShare |? name  -eq \"SYSVOL\")){$DC=$true}; if (-not $DC){return $([PSCustomObject]@{Name=\"N/A\";\"MemberCount\"= \"This computer is not a Domain Controller\"}|ConvertTo-Json)};$Filter = {admincount -eq 1 -and iscriticalsystemobject -like \"*\"};$PrivilegedGroups = Get-ADGroup -server $Domain -filter $Filter  -Properties * | Select-Object Name, members;[System.Collections.ArrayList]$aPrivGroupsMembersCount = @();foreach ($g in $PrivilegedGroups) {$PrivGroupMemberCountObj = [PSCustomObject]@{Name= $null;MemberCount = $null};$PrivGroupMemberCountObj.Name = $g.name;$PrivGroupMemberCountObj.MemberCount = $($g.members).count;$aPrivGroupsMembersCount += $PrivGroupMemberCountObj};$aPrivGroupsMembersCount|ConvertTo-Json";

const ADUSER = [
    "",
    "DistinguishedName : CN=Administrator,CN=Users,DC=corp,DC=example,DC=com",
    "Enabled           : True",
    "GivenName         :",
    "Name              : Administrator",
    "ObjectClass       : user",
    "ObjectGUID        : 6c1b7f5e-2d0a-4a7b-9d38-0f3a1e5c9b42",
    "SamAccountName    : Administrator",
    "SID               : S-1-5-21-1004336348-1177238915-682003330-500",
    "Surname           :",
    "UserPrincipalName :",
    ""
].join("\r\n");

const GROUPS = [
    { Name: "Domain Admins", MemberCount: 3 },
    { Name: "Enterprise Admins", MemberCount: 1 },
    { Name: "Schema Admins", MemberCount: 1 },
    { Name: "Administrators", MemberCount: 4 },
    { Name: "Account Operators", MemberCount: 0 },
    { Name: "Backup Operators", MemberCount: 2 }
];

module.exports = {
    cases: [{
        name: "domain controller, six privileged groups",
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-ADUser administrator", reply: reply.winrm(ADUSER) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: GET_STATUS, reply: reply.winrm(JSON.stringify(GROUPS, null, 4) + "\r\n") }] }
        }
    }, {
        name: "member server, not a domain controller (bare object)",
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-ADUser administrator", reply: reply.winrm(ADUSER) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: GET_STATUS, reply: reply.winrm(JSON.stringify({ Name: "N/A", MemberCount: "This computer is not a Domain Controller" }, null, 4) + "\r\n") }] }
        }
    }]
};
