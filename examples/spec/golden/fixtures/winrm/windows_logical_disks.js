// Simulated Windows 11 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of MSFT_Volume (Storage namespace:
// Path, DriveLetter, FileSystemLabel, FileSystem, Size, SizeRemaining in bytes, DriveType and HealthStatus as
// numbers) and of Get-BitLockerVolume (MountPoint "C:", VolumeStatus and ProtectionStatus enums as numbers in 5.1).
// Several volumes are an array (-Compress for the volumes, indented for BitLocker, as the script asks).
// The SSH mode runs the same two commands through `powershell -Command`.
const reply = require("../../replies");

const LOGICAL_DISKS_CMD = 'Get-CimInstance -ClassName MSFT_StorageSubSystem -Namespace Root\\Microsoft\\Windows\\Storage | Where-Object { $_.FriendlyName -like "*Win*" } | Get-CimAssociatedInstance -ResultClassName MSFT_Disk -PipelineVariable disk | Get-CimAssociatedInstance -ResultClassName MSFT_Partition -PipelineVariable partition | Get-CimAssociatedInstance -ResultClassName MSFT_Volume -PipelineVariable volume | Select-Object @{n="Disk Number";e={$disk.Number}}, @{n="Volume GUID";e={$volume.Path}}, DriveLetter, FileSystemLabel, FileSystem, Size, SizeRemaining, DriveType, @{n="IsReadOnly";e={$disk.IsReadOnly}}, HealthStatus | ConvertTo-Json -Compress';
const BITLOCKER_CMD = "Get-BitLockerVolume | Select-Object -Property MountPoint,VolumeStatus,EncryptionPercentage,ProtectionStatus | ConvertTo-Json";
const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';

const GIB = 1073741824;
const VOLUMES = [
    {
        "Disk Number": 0, "Volume GUID": "\\\\?\\Volume{6f1c2f0a-3b5e-4d7a-9c11-0a1b2c3d4e5f}\\", DriveLetter: "C", FileSystemLabel: "Windows",
        FileSystem: "NTFS", Size: 465 * GIB, SizeRemaining: 206 * GIB, DriveType: 3, IsReadOnly: false, HealthStatus: 0
    },
    {
        "Disk Number": 1, "Volume GUID": "\\\\?\\Volume{a2b3c4d5-1111-4222-8333-444455556666}\\", DriveLetter: "D", FileSystemLabel: "Data",
        FileSystem: "NTFS", Size: 1862 * GIB, SizeRemaining: 401 * GIB, DriveType: 3, IsReadOnly: false, HealthStatus: 1
    },
    {
        "Disk Number": 2, "Volume GUID": "\\\\?\\Volume{0a9b8c7d-6e5f-4a3b-b2c1-d0e9f8a7b6c5}\\", DriveLetter: "E", FileSystemLabel: "BACKUP",
        FileSystem: "FAT32", Size: 29 * GIB, SizeRemaining: 28 * GIB, DriveType: 2, IsReadOnly: true, HealthStatus: 0
    }
];
// VolumeStatus 1 = FullyEncrypted, 2 = EncryptionInProgress; ProtectionStatus 1 = On, 0 = Off. E: is not in BitLocker's list.
const BITLOCKER = [
    { MountPoint: "C:", VolumeStatus: 1, EncryptionPercentage: 100, ProtectionStatus: 1 },
    { MountPoint: "D:", VolumeStatus: 2, EncryptionPercentage: 42, ProtectionStatus: 0 }
];

const compact = (value) => JSON.stringify(value) + "\r\n";
const indented = (value) => JSON.stringify(value, null, 4) + "\r\n";

function calls(kind, wrap, send, volumes, bitlocker) {
    return [
        { kind, method: send, target: wrap(LOGICAL_DISKS_CMD), reply: kind === "ssh" ? reply.ssh(compact(volumes)) : reply.winrm(compact(volumes)) },
        { kind, method: send, target: wrap(BITLOCKER_CMD), reply: kind === "ssh" ? reply.ssh(indented(bitlocker)) : reply.winrm(indented(bitlocker)) }
    ];
}
const same = (command) => command;

function winrmCase(name, volumes, bitlocker) {
    const c = calls("winrm", same, "sendWinRMCommand", volumes, bitlocker);
    return { name, parameters: { protocol: "winrm" }, entryPoints: { validate: { calls: c }, get_status: { calls: c } } };
}

module.exports = {
    cases: [
        winrmCase("winrm, three volumes", VOLUMES, BITLOCKER),
        winrmCase("winrm, one BitLocker volume is a bare object", VOLUMES, BITLOCKER[0]),
        (() => {
            const c = calls("ssh", ssh, "sendSSHCommand", VOLUMES, BITLOCKER);
            return { name: "ssh, three volumes", parameters: { protocol: "ssh" }, entryPoints: { validate: { calls: c }, get_status: { calls: c } } };
        })()
    ]
};
