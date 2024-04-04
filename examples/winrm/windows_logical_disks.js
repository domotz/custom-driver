/**
 * Domotz Custom Driver 
 * Name: Windows Logical Disks
 * Description: Monitors the status of logical disks within a Windows machine.
 * 
 * Communication protocol is WinRM
 * 
 * Tested on Windows Version
 *  - Windows 11
 * 
 * Powershell Version:
 *  - 5.1.21996.1
 * 
 * Creates a Custom Driver Table with the following columns:
 *    - Drive Letter: The letter assigned to the logical disk
 *    - Name: The name of the file system on the disk
 *    - Physical Disk: The identifier for the physical disk associated with the logical disk
 *    - Usage: The percentage of disk space currently in use
 *    - Free Space: The amount of free space available on the disk in gigabytes
 *    - Size: The total size of the disk in gigabytes
 *    - File System: The type of file system used on the disk
 *    - Type: The type of disk drive
 *    - Is Readonly: Indicates whether the disk is read-only or not
 *    - BitLocker Status: The current status of BitLocker encryption on the disk 
 *    - BitLocker Protection Status: The protection status of BitLocker on the disk
 *    - BitLocker Encryption Percentage: The percentage of encryption progress if BitLocker encryption is in progress
 *    - Status: The overall health status of the disk
 * 
 * Privilege required: Administrator
 * 
 */

var logicalDisksCmd = 'Get-CimInstance -ClassName MSFT_StorageSubSystem -Namespace Root\\Microsoft\\Windows\\Storage | Where-Object { $_.FriendlyName -like "*Win*" } | Get-CimAssociatedInstance -ResultClassName MSFT_Disk -PipelineVariable disk | Get-CimAssociatedInstance -ResultClassName MSFT_Partition -PipelineVariable partition | Get-CimAssociatedInstance -ResultClassName MSFT_Volume -PipelineVariable volume | Select-Object @{n="Disk Number";e={$disk.Number}}, DriveLetter,FileSystemLabel,FileSystem,Size,SizeRemaining,DriveType, @{n="IsReadOnly";e={$disk.IsReadOnly}},HealthStatus | ConvertTo-Json -Compress';
var bitLockerCmd = 'Get-BitLockerVolume | Select-Object -Property MountPoint,VolumeStatus,EncryptionPercentage,ProtectionStatus | ConvertTo-Json';

var winrmConfig = {
    "username": D.device.username(),
    "password": D.device.password()
};

// Mapping of drive types
var driveTypes = {
    "0": "Unknown",
    "1": "Invalid Root Path",
    "2": "Removable",
    "3": "Fixed",
    "4": "Remote",
    "5": "CD-ROM",
    "6": "RAM Disk"
};

// Mapping of volume status
// https://learn.microsoft.com/en-us/windows/win32/secprov/win32-encryptablevolume
var volumeStatus = {
    "0": "Fully Decrypted",
    "1": "Fully Encrypted",
    "2": "Encryption In Progress",
    "3": "Decryption In Progress",
    "4": "Encryption Paused",
    "5": "Decryption Paused"
}

// Mapping of BitLocker protection status
var protectionStatus = {
    "0": "OFF",
    "1": "ON",
    "2": "UNKNOWN"
}

// Mapping of logical disks status
var statusTypes = {
    "0": "Ok",
    "1": "Scan Needed",
    "2": "Spot Fix Needed",
    "3": "Full Repair Needed"
}

// Custom Driver Table to store Logical disk information
var table = D.createTable(
    "Logical Disks", 
    [
        { label: "Drive Letter", valueType: D.valueType.STRING },
        { label: "Name", valueType: D.valueType.STRING },
        { label: "Physical Disk", valueType: D.valueType.STRING },
        { label: "Usage", unit: "%", valueType: D.valueType.NUMBER },
        { label: "Free Space", unit: "GiB", valueType: D.valueType.NUMBER },
        { label: "Size", unit: "GiB", valueType: D.valueType.NUMBER },
        { label: "File System", valueType: D.valueType.STRING },
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Is Readonly", valueType: D.valueType.STRING },
        { label: "BitLocker Status", valueType: D.valueType.STRING },
        { label: "BitLocker Protection Status", valueType: D.valueType.STRING },
        { label: "BitLocker Encryption Pct", unit: "%", valueType: D.valueType.NUMBER },
        { label: "Status", valueType: D.valueType.STRING }
    ]
);

// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Execute WinRM command
function executeWinrmCommand(command) {
    var d = D.q.defer();
    winrmConfig.command = command;
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            d.resolve(output);
        } else {
            checkWinRmError(output.error);
        }            
    });
    return d.promise;
}

/**
* @remote_procedure
* @label Validate WinRM connectivity with the device
* @documentation This procedure is used to validate the driver and credentials provided during association.
*/
function validate() {
    D.q.all([
        executeWinrmCommand(logicalDisksCmd),
        executeWinrmCommand(bitLockerCmd)
    ])
        .then(function (results) {
            results.forEach(function (output) {
                if (output.error !== null) {
                    console.error("Validation failed");
                    return D.failure(D.errorType.RESOURCE_UNAVAILABLE);
                }
            });
            console.log("Validation successful");
            return D.success();
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
* @remote_procedure
* @label Get Logical Disks Info
* @documentation This procedure retrieves information about logical disks installed on a Windows machine.
*/
function get_status() {
    executeWinrmCommand(logicalDisksCmd)
        .then(function(logicalDisksInfo){
            var logicalDisksOutput = JSON.parse(logicalDisksInfo.outcome.stdout);
            console.log((JSON.stringify(logicalDisksOutput)))
            return executeWinrmCommand(bitLockerCmd)
                .then(function(bitLockerInfo){
                    var bitLockerOutput = Array.isArray(bitLockerInfo.outcome.stdout) ? JSON.parse(bitLockerInfo.outcome.stdout) : [JSON.parse(bitLockerInfo.outcome.stdout)];
                    parseOutput(logicalDisksOutput, bitLockerOutput);
                })
                .catch(function (err) {
                    console.error(err);
                    D.failure(D.errorType.GENERIC_ERROR);
                });
        })
        .catch(checkWinRmError);
}

// Parse the output of WinRM commands and insert it into the table
function parseOutput(logicalDisksOutput, bitLockerOutput){
    var mergedOutput = [];

    for (var i = 0; i < logicalDisksOutput.length; i++) {
        var logicalDisk = logicalDisksOutput[i];
        var mergedDiskInfo = {
            "Disk Number": logicalDisk["Disk Number"],
            DriveLetter: logicalDisk.DriveLetter,
            FileSystemLabel: logicalDisk.FileSystemLabel,
            FileSystem: logicalDisk.FileSystem,
            Size: logicalDisk.Size,
            SizeRemaining: logicalDisk.SizeRemaining,
            DriveType: logicalDisk.DriveType,
            IsReadOnly: logicalDisk.IsReadOnly,
            HealthStatus: logicalDisk.HealthStatus
        };

        var bitLockerInfoFound = false;
        for (var j = 0; j < bitLockerOutput.length; j++) {
            var bitLockerInfo = bitLockerOutput[j];
            var mountPoint = bitLockerInfo.MountPoint ? bitLockerInfo.MountPoint.replace(":", "") : null;
            if (mountPoint === logicalDisk.DriveLetter) {
                mergedDiskInfo.MountPoint = mountPoint;
                mergedDiskInfo.VolumeStatus = bitLockerInfo.VolumeStatus;
                mergedDiskInfo.EncryptionPercentage = bitLockerInfo.EncryptionPercentage;
                mergedDiskInfo.ProtectionStatus = bitLockerInfo.ProtectionStatus;
                bitLockerInfoFound = true;
                break;
            }
        }

        if (!bitLockerInfoFound) {
            mergedDiskInfo.MountPoint = null;
            mergedDiskInfo.VolumeStatus = null;
            mergedDiskInfo.EncryptionPercentage = null;
            mergedDiskInfo.ProtectionStatus = null; 
        }
        mergedOutput.push(mergedDiskInfo);
        console.log(JSON.stringify(mergedOutput))
    }

    for (var k = 0; k < mergedOutput.length; k++) {
        var logicalDisks = mergedOutput[k];
        var recordId = (k + 1).toString();
        var driveLetter = logicalDisks.DriveLetter ? logicalDisks.DriveLetter : "N/A";
        var name = logicalDisks.FileSystemLabel ? logicalDisks.FileSystemLabel : "N/A";
        var physicalDisk = "Disk " + logicalDisks["Disk Number"] ? logicalDisks["Disk Number"] : "N/A";
        var size = logicalDisks.Size;
        console.log(size)
        var freeSpace = logicalDisks.SizeRemaining;
        console.log(freeSpace)
        var usage = (( size - freeSpace) / size) * 100
        var fileSystem = logicalDisks.FileSystem ? logicalDisks.FileSystem : "N/A"
        var type = logicalDisks.DriveType ? driveTypes[logicalDisks.DriveType] : "N/A"
        var isReadOnly = logicalDisks.IsReadOnly;
        var bitLockerStatus = logicalDisks.MountPoint !== null ? volumeStatus[logicalDisks.VolumeStatus] : "N/A"; 
        var bitLockerProtectionStatus = logicalDisks.MountPoint !== null ? protectionStatus[logicalDisks.ProtectionStatus] : "N/A";
        var bitLockerEncryptionPercentage = logicalDisks.MountPoint !== null ? logicalDisks.EncryptionPercentage : "N/A";
        var status = statusTypes[logicalDisks.HealthStatus];

        table.insertRecord(recordId, [
            driveLetter,
            name,
            physicalDisk,
            usage, 
            (freeSpace / (Math.pow(1024, 3))).toFixed(2),
            (size / (Math.pow(1024, 3))).toFixed(2),
            fileSystem,
            type,
            isReadOnly,
            bitLockerStatus, 
            bitLockerProtectionStatus, 
            bitLockerEncryptionPercentage,
            status
        ]);
    }
    D.success(table);
}

