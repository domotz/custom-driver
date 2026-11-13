// Simulated Windows Server 2019 domain controller / PowerShell 5.1 replies. Shape follows Get-GPO (GroupPolicy module):
// the list view for validate, and ConvertTo-Json of the PSCustomObjects the script builds for get_status, with
// GpoStatus written by its name (AllSettingsEnabled, UserSettingsDisabled, ...) and DSVersion/SysvolVersion as numbers.
const reply = require("../../replies");

const GET_GPO = [
    "",
    "",
    "DisplayName      : Default Domain Policy",
    "DomainName       : contoso.local",
    "Owner            : CONTOSO\\Domain Admins",
    "Id               : 31b2f340-016d-11d2-945f-00c04fb984f9",
    "GpoStatus        : AllSettingsEnabled",
    "Description      : ",
    "CreationTime     : 3/4/2019 9:15:02 AM",
    "ModificationTime : 11/20/2025 4:41:37 PM",
    "UserVersion      : AD Version: 0, SysVol Version: 0",
    "ComputerVersion  : AD Version: 14, SysVol Version: 14",
    "WmiFilter        : ",
    "",
    "",
    ""
].join("\r\n");

const COMMAND = "$GPOs =@('Default Domain Policy','Default Domain Controllers Policy');$GPOVersions = [System.Collections.ArrayList]::new();foreach ($p in $GPOs) {$GPData = Get-GPO -Name $p;$GPOVersions += [PSCustomObject]@{Name = $GPData.Displayname;Status= $($GPData.GpoStatus).ToString();UADVersion= $GPData.User.DSVersion;USVVersion= $GPData.User.SysvolVersion;CADVersion= $GPData.Computer.DSVersion;CSVVersion= $GPData.Computer.SysvolVersion;}};$GPOVersions | ConvertTo-Json";

const GPOS = [
    { Name: "Default Domain Policy", Status: "AllSettingsEnabled", UADVersion: 0, USVVersion: 0, CADVersion: 14, CSVVersion: 14 },
    { Name: "Default Domain Controllers Policy", Status: "UserSettingsDisabled", UADVersion: 3, USVVersion: 3, CADVersion: 9, CSVVersion: 8 }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";

module.exports = {
    cases: [{
        name: "domain controller, two gpos",
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: 'Get-GPO -Name "Default Domain Policy"', reply: reply.winrm(GET_GPO) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(GPOS)) }] }
        }
    }]
};
