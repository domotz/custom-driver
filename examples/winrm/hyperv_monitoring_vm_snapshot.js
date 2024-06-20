/**
 * Domotz Custom Driver 
 * Name: Hyper-V VM Snapshot
 * Description: This script retrieves information about the latest snapshots taken on Hyper-V virtual machines. It allows monitoring of snapshot creation time and age.
 * 
 * Communication protocol is WinRM
 * 
 * Tested on:
 *    - Windows 10
 *    - Windows Server 2019
 *    - Hyper-V 10.0.19041.1
 *    - Powershell version 5.1.19041.4412
 * 
 * Creates a Custom Driver Table with the following columns:
 *    - VM name: Name of the virtual machine
 *    - Snapshot name: Name of the snapshot
 *    - Creation time: The date and time when the latest snapshot was created
 *    - Age: The age of the latest snapshot in days
 *  
 * Privilege required: Hyper-V Administrators
 *   
 */

// WinRM command to retrieve VM snapshots
var command = 'Get-VM | ForEach-Object { $latestSnapshot = Get-VMSnapshot -VM $_ -ErrorAction SilentlyContinue | Sort-Object -Property CreationTime -Descending | Select-Object -First 1; if ($latestSnapshot -ne $null) { $formattedTime = $latestSnapshot.CreationTime.ToString("M/d/yyyy h:mm:ss tt"); [PSCustomObject]@{ VMID = $_.Id; VMName = $_.Name; Name = $latestSnapshot.Name; CreationTime = $formattedTime } } else { [PSCustomObject]@{ VMID = $_.Id; VMName = $_.Name; Name = ""; CreationTime = "" } } } | ConvertTo-Json';

// The name of the virtual machine
var vmNameFilter = D.getParameter("vmName");

// WinRM configuration
var winrmConfig = {
    "username": D.device.username(),
    "password": D.device.password()
};

// Table to store VM snapshots
var table = D.createTable(
    "Hyper-V VM Snapshots", 
    [
        { label: "VM name", valueType: D.valueType.STRING },
        { label: "Snapshot name", valueType: D.valueType.STRING },
        { label: "Creation time", valueType: D.valueType.DATETIME },
        { label: "Age", unit: "Days", valueType: D.valueType.NUMBER }
    ]
);

// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 401){
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code == 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute WinRM command
function executeWinrmCommand(command) {
    var d = D.q.defer();
    winrmConfig.command = command;
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            d.resolve(output);
        } else {
            d.reject(output.error);
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
    executeWinrmCommand(command)
        .then(parseValidateOutput)
        .then(D.success)
        .catch(checkWinRmError);
}

function parseValidateOutput(output) {
    if (output.outcome !== undefined && output.outcome.stdout.trim() !== "") {
        console.info("Validation successful");
    } else {
        console.error("Validation unsuccessful");
    }
}

/**
 * @remote_procedure
 * @label Get Hyper-V VM latest snapshots 
 * @documentation Retrieves information about the latest snapshots taken on Hyper-V virtual machines.
 */
function get_status() {
    executeWinrmCommand(command)
        .then(parseOutput)
        .catch(checkWinRmError);
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Parse the output of WinRM command and insert it into the table
function parseOutput(output){
    var vmSnapshot = JSON.parse(output.outcome.stdout);  
    vmSnapshot.forEach(function(snapshot){
        var vmId = snapshot.VMID;
        var vmName = snapshot.VMName;
        var snapshotName = snapshot.Name;
        var creationTime = snapshot.CreationTime;

        if (creationTime){
            var date = new Date(creationTime); 
            var currentDate = new Date();
            var ageInMilliseconds = currentDate - date;
            var ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));
        }
        if (vmNameFilter[0].toUpperCase() === "ALL" || vmNameFilter.indexOf(vmName) !== -1 ) {
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