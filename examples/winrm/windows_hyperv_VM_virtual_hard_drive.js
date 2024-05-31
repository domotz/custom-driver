/**
 * Domotz Custom Driver 
 * Name: Windows Hyper-V VM Virtual Hard Drives
 * Description: Show Hyper-V VM Virtual Hard Drives
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with the following columns:
 *    - Id: Unique identifier for the disk within the virtual hard drive system.
 *    - Name: User-friendly name of the virtual hard drive.
 *    - Pool Name: Name of the storage pool to which the virtual hard drive belongs.
 *    - Path: File path where the virtual hard drive is located.
 *    - Attached: Indicates if the virtual hard drive is currently attached to the virtual machine (Yes or No).
 *    - Disk Number: Number assigned to the disk within the virtual machine.
 *    - Controller Number: Number assigned to the controller to which the virtual hard drive is connected.
 *    - Capacity (GB): Size of the virtual hard drive.
 *    - Is Deleted: Indicates if the virtual hard drive has been deleted (Yes or No).
 * 
 * Privilege required: 
 *    - Administrator
 */


// The VM ID for which you want to display the Virtual Hard Drives.
var vmIdFilter = D.getParameter('vmId');

// WinRM command to retrieve VM Virtual Hard Drives
var getVmVirtualHardDrives= '(Get-VM -Id "' + vmIdFilter + '" | Select-Object -ExpandProperty HardDrives).ForEach({ $req = (Get-VHD -Path $_.Path); @{ "Id" = $_.Id; "Name" = $_.Name; "Path" = $_.Path; "DiskNumber" = $_.DiskNumber; "PoolName" = $_.PoolName; "IsDeleted" = $_.IsDeleted; "Attached" = $req.Attached; "Size" = [math]::round($req.Size / 1GB, 2); "ControllerNumber" = $_.ControllerNumber}}) | ConvertTo-Json';

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": getVmVirtualHardDrives,
    "username": D.device.username(),
    "password": D.device.password(),
};

// mapping boolean values to human-readable strings.
var booleanCodes = {
    "true": "Yes",
    "false": "No",
};

// Creation of custom driver table 
var virtualHardDrivesTable = D.createTable(
    "Virtual Hard Drives",
    [
        { label: "Name" },
        { label: "Pool Name" },
        { label: "Path" },
        { label: "Attached" },
        { label: "Capacity", unit: "GB", valueType: D.valueType.NUMBER },
        { label: "Controller Number" },
        { label: "Disk Number" },
        { label: "Is Deleted" }
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

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    winrmConfig.command = "Get-vm";
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            D.success();
        } else {
            checkWinRmError(output.error);
        }
    });
}

/**
 * @remote_procedure
 * @label Retrieve list of VM virtual hard drives
 * @documentation This procedure retrieves a list of virtual hard drives for the target virtual Machine 
 */
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

/**
 * @description Sanitizes the given output string by removing reserved words and special characters,
 * limiting its length to 50 characters, replacing spaces with hyphens, and converting it to lowercase.
 * @param {string} output - The string to be sanitized.
 * @returns {string} - The sanitized string.
 */
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
* @description Extracts the hard drive ID from the given input string.
* If the input contains a backslash ('\\'), it returns the substring after the first backslash.
* Otherwise, it returns the entire input.
* @param {string} input - The input string to extract the hard drive ID from.
* @returns {string} - The extracted hard drive ID or the original input string.
*/
function extractHardDriveId(input){
    var firstIndex = input.indexOf("\\");
    if (input.indexOf("\\") !== -1) {
        return input.substring(firstIndex + 1);
    } else {
        return input;
    }
}

function populateTable(id, Name, PoolName, Path, Attached, Size, ControllerNumber, DiskNumber, IsDeleted) {
    var recordId = sanitize(extractHardDriveId(id));  
    IsDeleted = booleanCodes[IsDeleted];
    DiskNumber = DiskNumber ? DiskNumber : 'N/A'  ;
    virtualHardDrivesTable.insertRecord(recordId, [Name, PoolName, Path, Attached, Size, ControllerNumber, DiskNumber, IsDeleted]);
}

/**
 * @description Parses the output of the WinRM command and fill the virtual hard drives table.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    if (output.error === null) {
        var jsonOutput = JSON.parse(JSON.stringify(output));
        var listOfVirtualHardDrives= [];
        if (!jsonOutput.outcome.stdout) {
            console.log("There are no virtual hard drives related to this filter.");
        } else {
            var result = JSON.parse(jsonOutput.outcome.stdout);
        }
        if (Array.isArray(result)) {
            listOfVirtualHardDrives= result;
        } else if (typeof result === 'object') {
            listOfVirtualHardDrives.push(result);
        }
        for (var k = 0; k < listOfVirtualHardDrives.length; k++) {
            populateTable(
                listOfVirtualHardDrives[k].Id,
                listOfVirtualHardDrives[k].Name,
                listOfVirtualHardDrives[k].PoolName,
                listOfVirtualHardDrives[k].Path,
                listOfVirtualHardDrives[k].Attached,
                listOfVirtualHardDrives[k].Size,
                listOfVirtualHardDrives[k].ControllerNumber,
                listOfVirtualHardDrives[k].DiskNumber,
                listOfVirtualHardDrives[k].IsDeleted
            );
        }
        D.success(virtualHardDrivesTable);
    } else {
        checkWinRmError(output.error);
    }
}
