// Simulated Windows 11 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of the hashtables the script emits
// per Win32_DiskDrive (DeviceID "\\\\.\\PHYSICALDRIVEn" JSON-escaped, Status "OK" / "Pred Fail", MediaType text of
// Win32_DiskDrive, sizes in GiB rounded by the script). One disk would be a bare object, not an array.
// The SSH mode runs the same script through `powershell -Command`.
const reply = require("../../replies");

const COMMAND = "Get-CimInstance Win32_DiskDrive | ForEach-Object { $partitions = Get-Partition -DiskNumber $_.index; $totalSize = [math]::Round($_.Size / 1GB, 2); $freeSpace = 0; foreach ($partition in $partitions) { $volume = Get-Volume -Partition $partition; if ($volume) { $freeSpace += $volume.SizeRemaining; } } $freeSpace = [math]::Round($freeSpace / 1GB, 2); $usedSpace = $totalSize - $freeSpace; $usagePercentage = if ($totalSize -ne 0) { [math]::round(($usedSpace / $totalSize) * 100, 2) } else { 0 }; @{ID = $_.DeviceID; Model = $_.Model; Status = $_.Status; Size = $totalSize; MediaType = $_.MediaType; SerialNumber = $_.SerialNumber; PartitionsCount = $partitions.Count; UsagePercentage = $usagePercentage; FreeSpace = $freeSpace;}} | ConvertTo-Json";
const SSH_COMMAND = 'powershell -Command "' + COMMAND.replace(/"/g, '\\"') + '"';

const DISKS = [
    {
        ID: "\\\\.\\PHYSICALDRIVE0", Model: "Samsung SSD 980 PRO 500GB", Status: "OK", Size: 465.76, MediaType: "Fixed hard disk media",
        SerialNumber: "0025_385A_01B2_4C3D.", PartitionsCount: 3, UsagePercentage: 55.68, FreeSpace: 206.45
    },
    {
        ID: "\\\\.\\PHYSICALDRIVE1", Model: "WDC WD20EZRZ-00Z5HB0", Status: "Pred Fail", Size: 1863.01, MediaType: "Fixed hard disk media",
        SerialNumber: "WD-WCC4M0123456", PartitionsCount: 1, UsagePercentage: 78.41, FreeSpace: 402.18
    }
];

const psJson = (value) => JSON.stringify(value, null, 4) + "\r\n";

module.exports = {
    cases: [{
        name: "winrm, two disks",
        parameters: { protocol: "winrm" },
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(DISKS)) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(DISKS)) }] }
        }
    }, {
        name: "winrm, one disk is a bare object",
        parameters: { protocol: "winrm" },
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(DISKS[0])) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(DISKS[0])) }] }
        }
    }, {
        name: "ssh, two disks",
        parameters: { protocol: "ssh" },
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: SSH_COMMAND, reply: reply.ssh(psJson(DISKS)) }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: SSH_COMMAND, reply: reply.ssh(psJson(DISKS)) }] }
        }
    }]
};
