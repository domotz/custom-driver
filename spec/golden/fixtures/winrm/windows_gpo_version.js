// Simulated Windows Server 2019 domain controller / PowerShell 5.1 replies. validate and get_status send the same
// script: it reads each GPO with Get-GPO (retried on the host itself after a 0x80072020 double-hop error), and prints
// ConvertTo-Json -Compress of @{gpos=...;errors=...;fallback=...}, with GpoStatus written by its name (AllSettingsEnabled,
// UserSettingsDisabled, ...) and DSVersion/SysvolVersion as numbers. A hashtable has no key order: "errors" comes first
// here, as PowerShell 5.1 printed it.
const reply = require("../../replies");

const COMMAND = "$h=[System.Net.Dns]::GetHostName();$gpos=@();$errs=@();$pin=$null;" +
    "foreach($p in @('Default Domain Policy','Default Domain Controllers Policy')){$g=$null;$e=$null;$hop=$false;" +
    "if(-not $pin){try{$g=Get-GPO -Name $p -ErrorAction Stop}" +
    "catch{$e=$_.Exception.Message;" +
    "if($_.Exception.HResult -eq -2147016672 -or $_.Exception.GetBaseException().HResult -eq -2147016672 -or " +
    "$e -match '0x80072020'){$hop=$true}}};" +
    "if(($pin -or $hop) -and -not $g){try{$g=Get-GPO -Name $p -Server $h -ErrorAction Stop;" +
    "if($g -and -not $pin){$pin=@{server=$h;reason=$e}}}" +
    "catch{$m='(on '+$h+': '+$_.Exception.Message+')';if($e){$e+=' '+$m}else{$e=$m}}};" +
    "if($g){$gpos+=[PSCustomObject]@{Name=$g.DisplayName;Status=$g.GpoStatus.ToString();" +
    "UADVersion=$g.User.DSVersion;USVVersion=$g.User.SysvolVersion;" +
    "CADVersion=$g.Computer.DSVersion;CSVVersion=$g.Computer.SysvolVersion}}" +
    "else{$errs+=$p+': '+$e}};" +
    "ConvertTo-Json -InputObject @{gpos=$gpos;errors=$errs;fallback=$pin} -Depth 4 -Compress";

const DDP = { Name: "Default Domain Policy", Status: "AllSettingsEnabled", UADVersion: 0, USVVersion: 0, CADVersion: 14, CSVVersion: 14 };
const DDCP = { Name: "Default Domain Controllers Policy", Status: "UserSettingsDisabled", UADVersion: 3, USVVersion: 3, CADVersion: 9, CSVVersion: 8 };
const NOT_FOUND_MESSAGE = "GPO with name Default Domain Controllers Policy was not found in the contoso.local domain.";
const NOT_FOUND = "Default Domain Controllers Policy: " + NOT_FOUND_MESSAGE;
const READ_ON_DC02 = { reason: "An operations error occurred. (Exception from HRESULT: 0x80072020)", server: "DC02" };

const scriptOutput = (gpos, errors, fallback) =>
    JSON.stringify({ errors: errors, fallback: fallback || null, gpos: gpos }) + "\r\n";

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
            name: "domain controller that is not the pdc emulator, read on the dc itself",
            entryPoints: bothEntryPoints(scriptOutput([DDP, DDCP], [], READ_ON_DC02))
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
