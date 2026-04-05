/**
 * Domotz Custom Driver
 * Name: Windows Physical Disks
 * Description: Monitors the status of physical disks within a Windows machine.
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 *
 * Tested on Windows Version
 *  - Windows 10
 *  - Windows 11
 *
 * PowerShell Version:
 *  - 5.1.21996.1
 *
 *  Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates a Custom Driver Table with the following columns:
 *    - Model: The model of the physical disk
 *    - Status: The current status of the disk
 *    - Size: The total size of the disk
 *    - Free Space: The available space on the disk
 *    - Usage: The percentage of the disk that is currently used
 *    - Media Type: The type of media the disk uses
 *    - Serial Number: The unique serial number assigned to the disk
 *    - Partitions: The number of partitions present on the disk
 *
 */
// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

const command = 'Get-CimInstance Win32_DiskDrive | ForEach-Object { $partitions = Get-Partition -DiskNumber $_.index; $totalSize = [math]::Round($_.Size / 1GB, 2); $freeSpace = 0; foreach ($partition in $partitions) { $volume = Get-Volume -Partition $partition; if ($volume) { $freeSpace += $volume.SizeRemaining; } } $freeSpace = [math]::Round($freeSpace / 1GB, 2); $usedSpace = $totalSize - $freeSpace; $usagePercentage = if ($totalSize -ne 0) { [math]::round(($usedSpace / $totalSize) * 100, 2) } else { 0 }; @{ID = $_.DeviceID; Model = $_.Model; Status = $_.Status; Size = $totalSize; MediaType = $_.MediaType; SerialNumber = $_.SerialNumber; PartitionsCount = $partitions.Count; UsagePercentage = $usagePercentage; FreeSpace = $freeSpace;}} | ConvertTo-Json';

const config = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
}

// Custom Driver Table to store physical disk information
const table = D.createTable(
    'Physical Disks',
    [
        {label: 'Model', valueType: D.valueType.STRING},
        {label: 'Status', valueType: D.valueType.STRING},
        {label: 'Size', unit: 'GiB', valueType: D.valueType.NUMBER},
        {label: 'Free Space', unit: 'GiB', valueType: D.valueType.NUMBER},
        {label: 'Usage', unit: '%', valueType: D.valueType.NUMBER},
        {label: 'Media Type', valueType: D.valueType.STRING},
        {label: 'Serial Number', valueType: D.valueType.STRING},
        {label: 'Partitions', valueType: D.valueType.NUMBER}
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

/**
 * @remote_procedure
 * @label Validate WinRM connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate() {
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Physical Disks Info
 * @documentation This procedure retrieves information about physiscal disks installed on a Windows machine
 */
function get_status() {
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}


function populateTable(disk) {
    const id = disk.ID || 'N/A'
    const model = disk.Model || 'N/A'
    const status = disk.Status || 'N/A'
    const size = disk.Size || 'N/A'
    const freeSpace = disk.FreeSpace || 'N/A'
    const usagePercentage = disk.UsagePercentage || 'N/A'
    const mediaType = disk.MediaType || 'N/A'
    const serialNumber = disk.SerialNumber || 'N/A'
    const partitions = disk.PartitionsCount || 'N/A'
    const recordId = sanitize(id)
    table.insertRecord(recordId, [model, status, size, freeSpace, usagePercentage, mediaType, serialNumber, partitions])
}


// Parse the output of WinRM commands and insert it into the table
function parseOutput(physicalDisks) {
    if (physicalDisks) {
        if (Array.isArray(physicalDisks)) {
            for (let k = 0; k < physicalDisks.length; k++) {
                populateTable(physicalDisks[k]);
            }
        } else if (typeof physicalDisks === 'object') {
            populateTable(physicalDisks);
        }
    } else {
        console.log("There are no Physical Disks rules.");
    }
    D.success(table)
}

// WinRM functions
function WinRMHandler() {
}

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
function SSHHandler() {
}

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
    return output ? JSON.parse(output) : null;
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}