// Simulated Windows Server 2019 domain controller / PowerShell 5.1 replies. validate and get_status send the same
// script: it reads each GPO with Get-GPO (pinned to the host on a DC that is not the PDC emulator), and prints
// ConvertTo-Json -Compress of @{gpos=...;errors=...}, with GpoStatus written by its name (AllSettingsEnabled,
// UserSettingsDisabled, ...) and DSVersion/SysvolVersion as numbers. A hashtable has no key order: "errors" comes first
// here, as PowerShell 5.1 printed it.
const reply = require("../../replies");

const COMMAND = "$s=@{};$cs=Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue;" +
    "if($cs.DomainRole -eq 4){$n=$cs.DNSHostName;if(-not $n){$n=$env:COMPUTERNAME};$s.Server=$n};" +
    "$gpos=@();$errs=@();" +
    "foreach($p in @('Default Domain Policy','Default Domain Controllers Policy')){" +
    "try{$g=Get-GPO -Name $p @s -ErrorAction Stop;" +
    "$gpos+=[PSCustomObject]@{Name=$g.DisplayName;Status=$g.GpoStatus.ToString();" +
    "UADVersion=$g.User.DSVersion;USVVersion=$g.User.SysvolVersion;" +
    "CADVersion=$g.Computer.DSVersion;CSVVersion=$g.Computer.SysvolVersion}}" +
    "catch{$errs+=$p+': '+$_.Exception.Message}};" +
    "ConvertTo-Json -InputObject @{gpos=$gpos;errors=$errs} -Depth 4 -Compress";

const DDP = { Name: "Default Domain Policy", Status: "AllSettingsEnabled", UADVersion: 0, USVVersion: 0, CADVersion: 14, CSVVersion: 14 };
const DDCP = { Name: "Default Domain Controllers Policy", Status: "UserSettingsDisabled", UADVersion: 3, USVVersion: 3, CADVersion: 9, CSVVersion: 8 };
const NOT_FOUND = "Default Domain Controllers Policy: GPO with name Default Domain Controllers Policy was not found in the contoso.local domain.";

const scriptOutput = (gpos, errors) => JSON.stringify({ errors: errors, gpos: gpos }) + "\r\n";

// Both entry points send the same command and get the same reply.
const bothEntryPoints = (stdout) => {
    const calls = [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(stdout) }];
    return { validate: { calls: calls }, get_status: { calls: calls } };
};

module.exports = {
    cases: [
        {
            name: "domain controller, two gpos",
            entryPoints: bothEntryPoints(scriptOutput([DDP, DDCP], []))
        },
        {
            name: "one gpo not found",
            entryPoints: bothEntryPoints(scriptOutput([DDP], [NOT_FOUND]))
        },
        {
            name: "powershell 5.1 array wrapper",
            entryPoints: bothEntryPoints(scriptOutput({ value: [DDP, DDCP], Count: 2 }, []))
        }
    ]
};
