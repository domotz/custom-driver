// Simulated Windows Server 2019 Hyper-V host / PowerShell 5.1 replies. Shape follows ConvertTo-Json (5.1, 4-space
// indent, two spaces after the colon) of the hashtables the script builds from Get-VM's VMNetworkAdapter objects
// (Id "Microsoft:<vm id>\<adapter id>", Name "Network Adapter", SwitchName null when the adapter is not connected to a
// switch, PoolName "", BandwidthPercentage 0 when no bandwidth management). A single adapter is a bare object.
const reply = require("../../replies");

const VM_ID = "5b0ff7ea-45cf-4f11-8c3c-1a4c27c0f5a1";
const COMMAND = '(Get-VM -id "' + VM_ID + '" | Select-Object -ExpandProperty NetworkAdapters).ForEach( { @{ "Id" = $_.Id; "Name" = $_.Name; "ClusterMonitored" = $_.ClusterMonitored; "PoolName" = $_.PoolName; "Connected" = $_.Connected; "SwitchName" = $_.SwitchName; "BandwidthPercentage" = $_.BandwidthPercentage; "IsDeleted" = $_.IsDeleted } }) | ConvertTo-Json';

const GET_VM = [
    "",
    "Name  State   CPUUsage(%) MemoryAssigned(M) Uptime      Status             Version",
    "----  -----   ----------- ----------------- ------      ------             -------",
    "dc-01 Running 3           4096              12.03:25:41 Operating normally 9.0",
    "",
    ""
].join("\r\n");

const ADAPTERS = [
    {
        Id: "Microsoft:" + VM_ID.toUpperCase() + "\\C2A3B1D4-7E55-4F0A-9B21-6D8E3F4A5C70", Name: "Network Adapter",
        ClusterMonitored: true, PoolName: "", Connected: true, SwitchName: "External-Switch", BandwidthPercentage: 0, IsDeleted: false
    },
    {
        Id: "Microsoft:" + VM_ID.toUpperCase() + "\\9E1D7C30-2B64-4A8F-8D05-3C7B9A1E6F42", Name: "Management",
        ClusterMonitored: false, PoolName: "", Connected: false, SwitchName: null, BandwidthPercentage: 0, IsDeleted: false
    }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const winrm = (target, stdout) => [{ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(stdout) }];
const entry = (data) => ({ validate: { calls: winrm("Get-vm", GET_VM) }, get_status: { calls: winrm(COMMAND, psJson(data)) } });

module.exports = {
    cases: [
        { name: "hyper-v vm, two adapters", parameters: { vmId: VM_ID }, entryPoints: entry(ADAPTERS) },
        { name: "hyper-v vm, one adapter is a bare object", parameters: { vmId: VM_ID }, entryPoints: entry(ADAPTERS[0]) }
    ]
};
