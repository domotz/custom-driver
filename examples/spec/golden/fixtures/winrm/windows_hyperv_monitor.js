// Simulated Windows Server 2019 Hyper-V host, PowerShell 5.1 replies. Shape follows ConvertTo-Json (5.1) of the
// hashtables the script builds: State is the VMState name (the script stringifies it, because the enum's numbers
// are not sequential and changed between Hyper-V module versions), DateTime as "\/Date(ms)\/", TimeSpan as an object with Total* members, osInfo is
// Msvm_KvpExchangeComponent.GuestIntrinsicExchangeItems (CIM instance XML, one string per item; null on a VM
// that is off) and 5.1 writes < and > as \u003c \u003e.
const reply = require("../../replies");

const CMD = "(Get-VM | ForEach-Object " +
"{ " +
    'try {$Kvp = Get-WmiObject -namespace root/virtualization/v2 -query ("Associators of {" + (Get-WmiObject -Namespace root/virtualization/v2 -Query "Select * From Msvm_ComputerSystem Where ElementName=`"$($_.Name)`"").path + "} Where ResultClass=Msvm_KvpExchangeComponent")' +
    '} catch {  Write-Error "Failed to execute the query. Error details: $_";}' +
    '@{ "Id" = $_.Id; "Name" = $_.Name; "State" = "$($_.State)"; "osInfo" = $Kvp.GuestIntrinsicExchangeItems; "MemoryAssigned" = [math]::round($_.MemoryAssigned / 1MB, 2); "CPUUsage" = $_.CPUUsage; "Status" = $_.Status; "CreationTime" = $_.CreationTime; "ProcessorCount" = $_.ProcessorCount; "Uptime" = $_.Uptime}' +
"}) | ConvertTo-Json";

function kvp(name, data) {
    return '<INSTANCE CLASSNAME="Msvm_KvpExchangeDataItem"><PROPERTY NAME="Caption" TYPE="string"></PROPERTY>' +
        '<PROPERTY NAME="Data" TYPE="string"><VALUE>' + data + "</VALUE></PROPERTY>" +
        '<PROPERTY NAME="Description" TYPE="string"></PROPERTY><PROPERTY NAME="ElementName" TYPE="string"></PROPERTY>' +
        '<PROPERTY NAME="Name" TYPE="string"><VALUE>' + name + "</VALUE></PROPERTY>" +
        '<PROPERTY NAME="Source" TYPE="uint16"><VALUE>2</VALUE></PROPERTY></INSTANCE>';
}

function span(days, hours, minutes, seconds) {
    const total = ((days * 24 + hours) * 60 + minutes) * 60 + seconds;
    return {
        Ticks: total * 10000000, Days: days, Hours: hours, Milliseconds: 0, Minutes: minutes, Seconds: seconds,
        TotalDays: total / 86400, TotalHours: total / 3600, TotalMilliseconds: total * 1000, TotalMinutes: total / 60, TotalSeconds: total
    };
}

// Date(2023, 10, 4, 9, 15, 30) UTC and Date(2024, 2, 19, 16, 45, 5) UTC
const VMS = [
    {
        Id: "5b0ff7ea-45cf-4f11-8c3c-1a4c27c0f5a1", Name: "dc-01", State: "Running",
        osInfo: [kvp("NetworkAddressIPv4", "10.0.0.10"), kvp("OSName", "Windows Server 2019 Standard"), kvp("OSVersion", "10.0.17763")],
        MemoryAssigned: 4096, CPUUsage: 3, Status: "Operating normally", CreationTime: "DATE:1699089330000", ProcessorCount: 2, Uptime: span(12, 3, 25, 41)
    },
    {
        Id: "c9d1c3f4-2a58-41e8-9a5f-7e3f21b8d0b2", Name: "web-02", State: "Running",
        osInfo: [kvp("OSName", "Ubuntu 22.04.3 LTS"), kvp("OSVersion", "22.04")],
        MemoryAssigned: 2048.5, CPUUsage: 17, Status: "Operating normally", CreationTime: "DATE:1710866705000", ProcessorCount: 4, Uptime: span(0, 5, 2, 9)
    },
    {
        Id: "0e6a1f77-9d3b-4b8e-8f6e-52d0a1c4e7c3", Name: "backup-03", State: "Saved",
        osInfo: null,
        MemoryAssigned: 0, CPUUsage: 0, Status: "Operating normally", CreationTime: "DATE:1699089330000", ProcessorCount: 1, Uptime: span(0, 0, 0, 0)
    }
];

// 5.1 style: 4-space indent, "<" ">" escaped, DateTime in the /Date()/ form.
function psJson(value) {
    return JSON.stringify(value, null, 4)
        .replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
        .replace(/"DATE:(\d+)"/g, '"\\/Date($1)\\/"');
}

module.exports = {
    cases: [{
        name: "hyper-v, three vms",
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-VM", reply: reply.winrm("\r\nName      State   CPUUsage(%) MemoryAssigned(M) Uptime   Status             Version\r\n----      -----   ----------- ----------------- ------   ------             -------\r\ndc-01     Running 3           4096              12.03:25:41 Operating normally 9.0\r\n") }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: CMD, reply: reply.winrm(psJson(VMS) + "\r\n") }] }
        }
    }, {
        name: "hyper-v, a single vm is a bare object",
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-VM", reply: reply.winrm("\r\nName  State   CPUUsage(%) MemoryAssigned(M) Uptime      Status             Version\r\n----  -----   ----------- ----------------- ------      ------             -------\r\ndc-01 Running 3           4096              12.03:25:41 Operating normally 9.0\r\n") }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: CMD, reply: reply.winrm(psJson(VMS[0]) + "\r\n") }] }
        }
    }]
};
