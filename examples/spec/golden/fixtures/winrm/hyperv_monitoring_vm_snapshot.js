// Simulated Windows Server 2019 Hyper-V host (PowerShell 5.1) reply. Shape follows ConvertTo-Json (5.1) of the
// [PSCustomObject]s the command builds: VMID is the Guid as a string, CreationTime is the pre-formatted
// "M/d/yyyy h:mm:ss tt" string (en-US) and is "" with an empty Name for a VM without snapshots.
// Two or more VMs give a JSON array, a single VM a bare object.
const reply = require("../../replies");

const CMD = 'Get-VM | ForEach-Object { $latestSnapshot = Get-VMSnapshot -VM $_ -ErrorAction SilentlyContinue | Sort-Object -Property CreationTime -Descending | Select-Object -First 1; if ($latestSnapshot -ne $null) { $formattedTime = $latestSnapshot.CreationTime.ToString("M/d/yyyy h:mm:ss tt"); [PSCustomObject]@{ VMID = $_.Id; VMName = $_.Name; Name = $latestSnapshot.Name; CreationTime = $formattedTime } } else { [PSCustomObject]@{ VMID = $_.Id; VMName = $_.Name; Name = ""; CreationTime = "" } } } | ConvertTo-Json';

const VMS = [
    { VMID: "5b0ff7ea-45cf-4f11-8c3c-1a4c27c0f5a1", VMName: "dc-01", Name: "Before AD upgrade", CreationTime: "11/4/2025 9:15:30 AM" },
    { VMID: "c9d1c3f4-2a58-41e8-9a5f-7e3f21b8d0b2", VMName: "web-02", Name: "web-02 - (3/19/2025 4:45:05 PM)", CreationTime: "3/19/2025 4:45:05 PM" },
    { VMID: "0e6a1f77-9d3b-4b8e-8f6e-52d0a1c4e7c3", VMName: "backup-03", Name: "", CreationTime: "" }
];

const out = reply.winrm(JSON.stringify(VMS, null, 4) + "\r\n");
const call = () => ({ kind: "winrm", method: "sendWinRMCommand", target: CMD, reply: out });
const single = () => ({ kind: "winrm", method: "sendWinRMCommand", target: CMD, reply: reply.winrm(JSON.stringify(VMS[0], null, 4) + "\r\n") });

module.exports = {
    cases: [{
        name: "all vms, one without snapshot",
        parameters: { vmName: ["All"] },
        entryPoints: { validate: { calls: [call()] }, get_status: { calls: [call()] } }
    }, {
        name: "filtered to one vm",
        parameters: { vmName: ["web-02"] },
        entryPoints: { validate: { calls: [call()] }, get_status: { calls: [call()] } }
    }, {
        name: "host with a single vm (bare object)",
        parameters: { vmName: ["All"] },
        entryPoints: { validate: { calls: [single()] }, get_status: { calls: [single()] } }
    }]
};
