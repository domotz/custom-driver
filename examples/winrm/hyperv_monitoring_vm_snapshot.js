/**
 * Domotz Custom Driver
 * Name: Hyper-V VM Snapshot
 * Description: This script retrieves information about the latest snapshots taken on Hyper-V virtual machines. It allows monitoring of snapshot creation time and age.
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Tested on:
 *    - Windows 10
 *    - Windows Server 2019
 *    - Hyper-V 10.0.19041.1
 *    - PowerShell version 5.1.19041.4412
 *
 * Creates a Custom Driver Table with the following columns:
 *    - VM name: Name of the virtual machine
 *    - Snapshot name: Name of the snapshot
 *    - Creation time: The date and time when the latest snapshot was created
 *    - Age: The age of the latest snapshot in days
 *
 * Privilege required: Hyper-V Administrators
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 */

// WinRM command to retrieve VM snapshots
var command = 'Get-VM | ForEach-Object { $latestSnapshot = Get-VMSnapshot -VM $_ -ErrorAction SilentlyContinue | Sort-Object -Property CreationTime -Descending | Select-Object -First 1; if ($latestSnapshot -ne $null) { $formattedTime = $latestSnapshot.CreationTime.ToString("M/d/yyyy h:mm:ss tt"); [PSCustomObject]@{ VMID = $_.Id; VMName = $_.Name; Name = $latestSnapshot.Name; CreationTime = $formattedTime } } else { [PSCustomObject]@{ VMID = $_.Id; VMName = $_.Name; Name = ""; CreationTime = "" } } } | ConvertTo-Json';

// The name of the virtual machine
const vmNameFilter = D.getParameter("vmName");

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// configuration
var config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000,
};

// Table to store VM snapshots
var table = D.createTable(
    "Hyper-V VM Snapshots",
    [
        {label: "VM name", valueType: D.valueType.STRING},
        {label: "Snapshot name", valueType: D.valueType.STRING},
        {label: "Creation time", valueType: D.valueType.DATETIME},
        {label: "Age", unit: "Days", valueType: D.valueType.NUMBER}
    ]
);

function sanitize(output) {
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Parse the output command and insert it into the table
function parseOutput(vmSnapshots) {
    vmSnapshots.forEach(function (snapshot) {
        var vmId = snapshot.VMID;
        var vmName = snapshot.VMName;
        var snapshotName = snapshot.Name;
        var creationTime = snapshot.CreationTime;

        if (creationTime) {
            var date = new Date(creationTime);
            var currentDate = new Date();
            var ageInMilliseconds = currentDate - date;
            var ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
        }
        if (vmNameFilter[0].toUpperCase() === "ALL" || vmNameFilter.indexOf(vmName) !== -1) {
            var recordId = sanitize(vmId);
            table.insertRecord(recordId, [
                vmName || "N/A",
                snapshotName || "N/A",
                creationTime || "N/A",
                ageInDays || 0
            ]);

        }
    });
    D.success(table);
}

function parseValidateOutput (isValidated) {
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
 * @label Validate connectivity with the device
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
 * @label Get Hyper-V VM latest snapshots
 * @documentation Retrieves information about the latest snapshots taken on Hyper-V virtual machines.
 */
function get_status() {
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
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
    var d = D.q.defer();
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
    return JSON.parse(output.outcome.stdout);
}

WinRMHandler.prototype.checkIfValidated = function (output) {
    if (output.outcome !== undefined && output.outcome.stdout.trim() !== "") {
        console.info("Validation successful");
        D.success();
    } else {
        console.error("Validation unsuccessful");
        D.failure(D.errorType.GENERIC_ERROR);
    }
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
    var d = D.q.defer();
    var self = this;
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
    return output !== undefined && output.trim() !== ""
}