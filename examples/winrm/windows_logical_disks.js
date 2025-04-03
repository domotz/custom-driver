/**
 * Domotz Custom Driver
 * Name: Windows Logical Disks
 * Description: Monitors the status of logical disks within a Windows machine.
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 *
 * Tested on Windows Version
 *  - Windows 11
 *
 * PowerShell Version:
 *  - 5.1.21996.1
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates a Custom Driver Table with the following columns:
 *    - Drive: The letter assigned to the logical disk
 *    - Name: The name of the file system on the disk
 *    - Physical Disk: The identifier for the physical disk associated with the logical disk
 *    - Usage: The percentage of disk space currently in use
 *    - Free Space: The amount of free space available on the disk in gigabytes
 *    - Size: The total size of the disk in gigabytes
 *    - File System: The type of file system used on the disk
 *    - Type: The type of disk drive
 *    - ReadOnly: Indicates whether the disk is read-only or not
 *    - BitLocker Status: The current status of BitLocker encryption on the disk
 *    - BitLocker Protection Status: The protection status of BitLocker on the disk
 *    - BitLocker Encryption Percentage: The percentage of encryption progress if BitLocker encryption is in progress
 *    - Status: The overall health status of the disk
 *
 *  Privilege required:
 *   - To retrieve logical disks information:
 *     Access to the namespace "Root\Microsoft\Windows\Storage".
 *     This can be achieved by executing the Domotz script ".\enable_winrm_os_monitoring.ps1 -GroupName YourADGroup -WmiAccessOnly -Namespaces "Root\Microsoft\Windows\Storage".
 *
 *   - To retrieve BitLocker information: Administrator permissions are required.
 *
 */
// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

const logicalDisksCmd = 'Get-CimInstance -ClassName MSFT_StorageSubSystem -Namespace Root\\Microsoft\\Windows\\Storage | Where-Object { $_.FriendlyName -like "*Win*" } | Get-CimAssociatedInstance -ResultClassName MSFT_Disk -PipelineVariable disk | Get-CimAssociatedInstance -ResultClassName MSFT_Partition -PipelineVariable partition | Get-CimAssociatedInstance -ResultClassName MSFT_Volume -PipelineVariable volume | Select-Object @{n="Disk Number";e={$disk.Number}}, @{n="Volume GUID";e={$volume.Path}}, DriveLetter, FileSystemLabel, FileSystem, Size, SizeRemaining, DriveType, @{n="IsReadOnly";e={$disk.IsReadOnly}}, HealthStatus | ConvertTo-Json -Compress'
const bitLockerCmd = 'Get-BitLockerVolume | Select-Object -Property MountPoint,VolumeStatus,EncryptionPercentage,ProtectionStatus | ConvertTo-Json'

const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
}

// Mapping of drive types
const driveTypes = {
    "0": "Unknown",
    "1": "Invalid Root Path",
    "2": "Removable",
    "3": "Fixed",
    "4": "Remote",
    "5": "CD-ROM",
    "6": "RAM Disk"
}

// Mapping of volume status
// https://learn.microsoft.com/en-us/windows/win32/secprov/win32-encryptablevolume
const volumeStatus = {
    "0": "Fully Decrypted",
    "1": "Fully Encrypted",
    "2": "Encryption In Progress",
    "3": "Decryption In Progress",
    "4": "Encryption Paused",
    "5": "Decryption Paused"
}

// Mapping of BitLocker protection status
const protectionStatus = {
    "0": "OFF",
    "1": "ON",
    "2": "UNKNOWN"
}

// Mapping of logical disks status
const statusTypes = {
    "0": "Ok",
    "1": "Scan Needed",
    "2": "Spot Fix Needed",
    "3": "Full Repair Needed"
}

// Custom Driver Table to store Logical disk information
const table = D.createTable(
    "Logical Disks",
    [
        {label: "Drive", valueType: D.valueType.STRING},
        {label: "Name", valueType: D.valueType.STRING},
        {label: "Physical Disk", valueType: D.valueType.STRING},
        {label: "Usage", unit: "%", valueType: D.valueType.NUMBER},
        {label: "Free Space", unit: "GiB", valueType: D.valueType.NUMBER},
        {label: "Size", unit: "GiB", valueType: D.valueType.NUMBER},
        {label: "File System", valueType: D.valueType.STRING},
        {label: "Type", valueType: D.valueType.STRING},
        {label: "ReadOnly", valueType: D.valueType.STRING},
        {label: "BitLocker Status", valueType: D.valueType.STRING},
        {label: "BitLocker Protection Status", valueType: D.valueType.STRING},
        {label: "BitLocker Encryption", unit: "%", valueType: D.valueType.NUMBER},
        {label: "Status", valueType: D.valueType.STRING}
    ]
)

function parseValidateOutput(isValidated) {
    if (isValidated) {
        console.info("Validation successful");
        D.success();
    } else {
        console.error("Validation unsuccessful");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

function execute() {
    return D.q.all([
        instance.executeCommand(logicalDisksCmd),
        instance.executeCommand(bitLockerCmd)
    ])
}

function checkIfValidated(output) {
    return instance.checkIfValidated(output[0]) && instance.checkIfValidated(output[1])
}

function parseOutputToJson(output) {
    return [
        instance.parseOutputToJson(output[0]),
        instance.parseOutputToJson(output[1])
    ]
}

/**
 * @remote_procedure
 * @label Validate connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate() {
    execute()
        .then(checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Logical Disks Info
 * @documentation This procedure retrieves information about logical disks installed on a Windows machine.
 */
function get_status() {
    execute()
        .then(parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

/**
 * Generates a md5 hash of the provided value
 * @param {string} value - The input string to hash
 * @returns {string} The md5 hash of the input value in hexadecimal format
 */
function md5(value) {
    return D.crypto.hash(value, "md5", null, "hex")
}

/**
 * Sanitizes the output by removing reserved words and formatting it.
 * @param {string} output - The string to be sanitized.
 * @returns {string} The sanitized string.
 */
function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

function checkEmptyString(string) {
    return string ? string : "N/A";
}

function checkEmptyNumber(number) {
    return number ? number : 0;
}

function convertToGB(freeSpace) {
    return (freeSpace / Math.pow(1024, 3)).toFixed(2);
}

function populateTable(logicalDiskInfo, bitLockerInfo) {
    const recordId = logicalDiskInfo["Volume GUID"]
    const diskNumber = logicalDiskInfo["Disk Number"]
    const physicalDisk = diskNumber !== undefined ? "Disk " + diskNumber : "N/A"
    const size = checkEmptyNumber(logicalDiskInfo.Size)
    const freeSpace = checkEmptyNumber(logicalDiskInfo.SizeRemaining)
    const usage = size ? ((size - freeSpace) / size) * 100 : 0
    const type = logicalDiskInfo.DriveType ? driveTypes[logicalDiskInfo.DriveType] : "N/A"
    const bitLockerStatus = bitLockerInfo.MountPoint !== null ? volumeStatus[bitLockerInfo.VolumeStatus] : "N/A"
    const bitLockerProtectionStatus = bitLockerInfo.MountPoint !== null ? protectionStatus[bitLockerInfo.ProtectionStatus] : "N/A"
    const bitLockerEncryptionPercentage = bitLockerInfo.MountPoint !== null ? bitLockerInfo.EncryptionPercentage : "N/A"
    const status = logicalDiskInfo.HealthStatus !== undefined ? statusTypes[logicalDiskInfo.HealthStatus] : "N/A"
    table.insertRecord(sanitize(md5(recordId)), [
        checkEmptyString(logicalDiskInfo.DriveLetter),
        checkEmptyString(logicalDiskInfo.FileSystemLabel),
        physicalDisk,
        usage.toFixed(2),
        convertToGB(freeSpace),
        convertToGB(size),
        checkEmptyString(logicalDiskInfo.FileSystem),
        type,
        checkEmptyString(logicalDiskInfo.IsReadOnly),
        bitLockerStatus,
        bitLockerProtectionStatus,
        bitLockerEncryptionPercentage,
        status
    ])
}

function extractBitLockerInfo(bitLockerOutput, logicalDiskDriveLetter) {
    const bitLockerInfo = {
        MountPoint: null,
        VolumeStatus: null,
        EncryptionPercentage: null,
        ProtectionStatus: null
    }

    for (let j = 0; j < bitLockerOutput.length; j++) {
        if (bitLockerOutput[j]) {
            const bitLockerDrive = bitLockerOutput[j].MountPoint.replace(":", "")
            if (bitLockerDrive === logicalDiskDriveLetter) {
                bitLockerInfo.MountPoint = bitLockerDrive
                bitLockerInfo.VolumeStatus = bitLockerOutput[j].VolumeStatus
                bitLockerInfo.EncryptionPercentage = bitLockerOutput[j].EncryptionPercentage
                bitLockerInfo.ProtectionStatus = bitLockerOutput[j].ProtectionStatus
                break
            }
        }
    }
    return bitLockerInfo;
}

// Parse the output of commands and insert it into the table
function parseOutput(output) {
    const logicalDisksOutput = output[0]
    const bitLockerOutput = Array.isArray(output[1]) ? output[1] : [output[1]]
    for (let i = 0; i < logicalDisksOutput.length; i++) {
        const logicalDiskInfo = logicalDisksOutput[i]
        const bitLockerInfo = extractBitLockerInfo(bitLockerOutput, logicalDiskInfo.DriveLetter)
        populateTable(logicalDiskInfo, bitLockerInfo);
    }
    D.success(table)
}

// WinRM functions
function WinRMHandler() {}

// Check for Errors on the command response
WinRMHandler.prototype.checkError = function (output) {
    if (output.message) console.error(output.message);
    if (output.code === 401) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (output.code === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(output);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute command
WinRMHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    config.command = command;
    D.device.sendWinRMCommand(config, function (output) {
        if (output.error) {
            self.checkError(output);
            d.reject(output.error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

WinRMHandler.prototype.parseOutputToJson = function (output) {
    const jsonString = output.outcome.stdout
    return jsonString ? JSON.parse(jsonString) : null;
}

WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout
}

// SSH functions
function SSHHandler() {}

// Check for Errors on the command response
SSHHandler.prototype.checkError = function (output, error) {
    if (error) {
        if (error.message) console.error(error.message);
        if (error.code === 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
        if (error.code === 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

SSHHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    const self = this;
    config.command = 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
    D.device.sendSSHCommand(config, function (output, error) {
        if (error) {
            self.checkError(output, error);
            d.reject(error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

SSHHandler.prototype.parseOutputToJson = function (output) {
    return JSON.parse(output);
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}