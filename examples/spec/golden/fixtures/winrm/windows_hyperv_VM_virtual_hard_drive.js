// Simulated Windows Server 2019 Hyper-V host / PowerShell 5.1 replies. Shape follows ConvertTo-Json (5.1, 4-space
// indent, two spaces after the colon) of the hashtables the script builds from Get-VM's VMHardDiskDrive objects
// (Id "Microsoft:<vm id>\<device id>\<controller>\<location>\D", Name "Hard Drive", Path, PoolName "Primordial",
// DiskNumber null for a VHD, IsDeleted, ControllerNumber/Location) and Get-VHD (Attached, Size in bytes, divided by 1GB
// and rounded by the script). A single drive is a bare object.
const reply = require("../../replies");

const VM_ID = "5b0ff7ea-45cf-4f11-8c3c-1a4c27c0f5a1";
const COMMAND = '(Get-VM -Id "' + VM_ID + '" | Select-Object -ExpandProperty HardDrives).ForEach({ $req = (Get-VHD -Path $_.Path); @{ "Id" = $_.Id; "Name" = $_.Name; "Path" = $_.Path; "DiskNumber" = $_.DiskNumber; "PoolName" = $_.PoolName; "IsDeleted" = $_.IsDeleted; "Attached" = $req.Attached; "Size" = [math]::round($req.Size / 1GB, 2); "ControllerNumber" = $_.ControllerNumber; "ControllerLocation" = $_.ControllerLocation}}) | ConvertTo-Json';

const GET_VM = [
    "",
    "Name  State   CPUUsage(%) MemoryAssigned(M) Uptime      Status             Version",
    "----  -----   ----------- ----------------- ------      ------             -------",
    "dc-01 Running 3           4096              12.03:25:41 Operating normally 9.0",
    "",
    ""
].join("\r\n");

const DRIVES = [
    {
        Id: "Microsoft:" + VM_ID.toUpperCase() + "\\83F8638B-8DCA-4152-9EDA-2CA8B33039B4\\0\\0\\D", Name: "Hard Drive",
        Path: "D:\\Hyper-V\\dc-01\\dc-01.vhdx", DiskNumber: null, PoolName: "Primordial", IsDeleted: false,
        Attached: true, Size: 127, ControllerNumber: 0, ControllerLocation: 0
    },
    {
        Id: "Microsoft:" + VM_ID.toUpperCase() + "\\83F8638B-8DCA-4152-9EDA-2CA8B33039B4\\0\\1\\D", Name: "Hard Drive",
        Path: "E:\\Hyper-V\\dc-01\\dc-01-data.vhdx", DiskNumber: null, PoolName: "Primordial", IsDeleted: false,
        Attached: false, Size: 512.5, ControllerNumber: 0, ControllerLocation: 1
    }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const winrm = (target, stdout) => [{ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(stdout) }];
const entry = (data) => ({ validate: { calls: winrm("Get-vm", GET_VM) }, get_status: { calls: winrm(COMMAND, psJson(data)) } });

module.exports = {
    cases: [
        { name: "hyper-v vm, two drives", parameters: { vmId: VM_ID }, entryPoints: entry(DRIVES) },
        { name: "hyper-v vm, one drive is a bare object", parameters: { vmId: VM_ID }, entryPoints: entry(DRIVES[0]) }
    ]
};
