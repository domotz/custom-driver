/**
 * Domotz Custom Driver
 * Name: Veeam Backup Sessions Monitoring (External Device)
 * Description: This script provides the status of replication job or the last n replication jobs of a single VM replicated by Veeam
 *
 * TESTING ENVIRONMENT:
 * The script was tested on "Veeam Backup & Replication 12" v12.3.2.3617 Community Edition 
 * for Hyper-V replicas on Windows Server 2022. In this case, Veeam doesn't support API,
 * hence the script connects to the Windows Server operating system via SSH or WinRM and 
 * performs PowerShell interrogations to the Veeam server running on it.
 *
 * COMMUNICATION PROTOCOLS:
 *      - WinRM
 *      - SSH
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * TESTED ON:
 *      - Windows Server 2022 (with Veeam Backup & Replication 12 v12.3.2.3617 Community Edition)
 * PowerShell Version:
 *      - 5.1.20348.3932
 *
 * INPUT PARAMETERS:
 *      - vmName: Name of the VM that is replicated by Veeam server (required)
 *      - protocol: Can be SSH or WINRM (required)
 *      - veeamServerIP: IP address of the Veeam Server (required)
 *      - veeamServerUsername: Username of the server where Veeam server runs, created for Domotz to connect to such server (required) - the user must have Local Administrator privileges (because Get-VBRBackupSession is a Veeam PowerShell cmdlet and cannot run without it)
 *      - veeamServerPassword: Password of the server where Veeam server runs, created for Domotz to connect to such server (required) - the user must have Local Administrator privileges (because Get-VBRBackupSession is a Veeam PowerShell cmdlet and cannot run without it)
 *      - numberOfResults: Number of jobs for which to get the status shown in the table output, ordered by running date desc. If 1, retrieves only the latest job replication (optional, defaults to 100)
 *
 * Create a Custom Driver table with a list of Veeam backup sessions for a specific VM
 *
 * REQUIREMENTS:
 *      - Local Administrator privileges
 *      - WinRM Enabled: To run the script using WinRM
 *      - SSH Enabled: To run the script using SSH
 *      - Veeam Backup & Replication PowerShell module installed
 **/

// VM name to monitor (required parameter)
const vmName = D.getParameter('vmName');

// Number of results to return (optional, defaults to 100)
let numberOfResults = D.getParameter('numberOfResults');
if (!numberOfResults || numberOfResults === '' || numberOfResults === '0') {
    numberOfResults = 100;
}

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

/**
 * @description Veeam Server IP Address
 * @type STRING
 */
const veeamServerIP = D.getParameter('veeamServerIP');

/**
 * @description Veeam Server Username
 * @type STRING
 */
const veeamServerUsername = D.getParameter('veeamServerUsername');

/**
 * @description Veeam Server Password
 * @type SECRET_TEXT
 */
const veeamServerPassword = D.getParameter('veeamServerPassword');

// Create external device connection
const veeamDevice = D.createExternalDevice(veeamServerIP
/**    
, {"username": veeamServerUsername,"password": veeamServerPassword}
 */
);

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

/**
 * Generates a PowerShell command to retrieve Veeam backup session information.
 * @returns {string}
 */
function generateVeeamCmd() {
    if (!vmName || vmName === '') {
        return '';
    }
    
    // Always fetch at least 2 records for calculations, even if user wants only 1
    const fetchCount = Math.max(parseInt(numberOfResults), 2);
    
    const command = 'Import-Module Veeam.Backup.PowerShell -WarningAction SilentlyContinue; Get-VBRBackupSession | Sort-Object EndTime -Descending | ForEach-Object { $session = $_; $session.GetTaskSessions() | Where-Object { $_.Name -eq "' + vmName + '" } | ForEach-Object { [PSCustomObject]@{ VM = $_.Name; Status = $_.Status; Job = $session.JobName; StartTime = $session.CreationTime; EndTime = $session.EndTime } } } | Sort-Object EndTime -Descending | Select-Object -First ' + fetchCount + ' | ForEach-Object { Write-Output ("{0},{1},{2},{3},{4}" -f $_.VM, $_.Status, $_.Job, $_.StartTime, $_.EndTime) }';
    
    return command;
}

// Define the WinRM/SSH options when running the commands
const config = {
    "username": veeamServerUsername,
    "password": veeamServerPassword,
    "timeout": 60000
};

const veeamTable = D.createTable(
    "Veeam Backup Sessions",
    [
        {label: "VM Name"},
        {label: "Status"},
        {label: "Job Name"},
        {label: "Start Time"},
        {label: "End Time"},
        {label: "Job Duration (min)"},
        {label: "Previous Backup Taken (hours)"}
    ]
);

var recordCounter = 1;
var backupRecords = []; // Store all backup records for calculating previous backup times

/**
 * Parse Veeam date format (DD/MM/YYYY HH:MM:SS) to JavaScript Date object
 * @param {string} dateStr - Date string in DD/MM/YYYY HH:MM:SS format
 * @returns {Date} - Parsed Date object
 */
function parseVeeamDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') {
        return new Date();
    }
    
    // Expected format: "16/08/2025 22:00:04"
    const parts = dateStr.trim().split(' ');
    if (parts.length !== 2) {
        console.error("Invalid date format: " + dateStr);
        return new Date();
    }
    
    const datePart = parts[0]; // "16/08/2025"
    const timePart = parts[1]; // "22:00:04"
    
    const dateComponents = datePart.split('/');
    const timeComponents = timePart.split(':');
    
    if (dateComponents.length !== 3 || timeComponents.length !== 3) {
        console.error("Invalid date/time components: " + dateStr);
        return new Date();
    }
    
    const day = parseInt(dateComponents[0], 10);
    const month = parseInt(dateComponents[1], 10) - 1; // JavaScript months are 0-based
    const year = parseInt(dateComponents[2], 10);
    const hour = parseInt(timeComponents[0], 10);
    const minute = parseInt(timeComponents[1], 10);
    const second = parseInt(timeComponents[2], 10);
    
    return new Date(year, month, day, hour, minute, second);
}

function populateTable(record, index) {
    const vmName = record.vmName;
    const status = record.status;
    const jobName = record.jobName;
    const startTime = record.startTime;
    const endTime = record.endTime;
    const jobDuration = record.jobDuration;
    const previousBackupTaken = record.previousBackupTaken;
    
    const recordID = recordCounter.toString();
    recordCounter++;
    veeamTable.insertRecord(recordID, [vmName, status, jobName, startTime, endTime, jobDuration, previousBackupTaken]);
}

function parseOutput(output) {
    recordCounter = 1; // Reset counter for each execution
    backupRecords = []; // Reset backup records array
    
    if (!output || output.trim() === '') {
        console.info("No Veeam backup sessions found for VM: " + vmName);
        D.success(veeamTable);
        return;
    }
    
    const lines = output.trim().split('\n');
    
    // First pass: Parse all records and store them
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line !== '') {
            const parts = line.split(',');
            if (parts.length >= 5) {
                const record = {
                    vmName: parts[0],
                    status: parts[1],
                    jobName: parts[2],
                    startTime: parts[3],
                    endTime: parts[4],
                    startDate: parseVeeamDate(parts[3]),
                    endDate: parseVeeamDate(parts[4])
                };
                backupRecords.push(record);
            }
        }
    }
    
    // Second pass: Calculate job duration and previous backup times
    const currentTime = new Date();
    const displayCount = parseInt(numberOfResults);
    
    for (let i = 0; i < backupRecords.length; i++) {
        const record = backupRecords[i];
        
        // Debug logging
        console.info("Processing record " + i + ": Start=" + record.startTime + ", End=" + record.endTime);
        console.info("Parsed dates: Start=" + record.startDate + ", End=" + record.endDate);
        
        // Calculate job duration in minutes
        const durationMs = record.endDate.getTime() - record.startDate.getTime();
        const durationMinutes = Math.round(durationMs / (1000 * 60));
        record.jobDuration = isNaN(durationMinutes) ? "0" : durationMinutes.toString();
        
        console.info("Duration calculation: " + durationMs + "ms = " + durationMinutes + " minutes");
        
        // Calculate previous backup taken in hours
        if (i === 0) {
            // This is the most recent backup - calculate time since completion
            const timeSinceEndMs = currentTime.getTime() - record.endDate.getTime();
            const timeSinceEndHours = Math.round(timeSinceEndMs / (1000 * 60 * 60));
            record.previousBackupTaken = isNaN(timeSinceEndHours) ? "0" : timeSinceEndHours.toString();
            console.info("Time since last backup: " + timeSinceEndMs + "ms = " + timeSinceEndHours + " hours");
        } else {
            // This is not the most recent backup - calculate time between this backup and the previous one
            const previousRecord = backupRecords[i - 1];
            const timeBetweenMs = previousRecord.endDate.getTime() - record.endDate.getTime();
            const timeBetweenHours = Math.round(timeBetweenMs / (1000 * 60 * 60));
            record.previousBackupTaken = isNaN(timeBetweenHours) ? "0" : timeBetweenHours.toString();
            console.info("Time between backups: " + timeBetweenMs + "ms = " + timeBetweenHours + " hours");
        }
        
        // Only populate the table with records up to the requested numberOfResults
        if (i < displayCount) {
            console.info("Displaying record " + i + " (within requested count of " + displayCount + ")");
            populateTable(record, i);
        } else {
            console.info("Skipping display of record " + i + " (beyond requested count of " + displayCount + ")");
        }
    }
    
    D.success(veeamTable);
}

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
 * @label Validate is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials and privileges provided
 */
function validate() {
    const validateCmd = "Import-Module Veeam.Backup.PowerShell -WarningAction SilentlyContinue; Get-VBRBackupSession | Select-Object -First 1";
    instance.executeCommand(validateCmd)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Veeam backup sessions data
 * @documentation This procedure retrieves Veeam backup session data for the specified VM
 */
function get_status() {
    if (!vmName || vmName === '') {
        console.error("VM name parameter is required");
        D.failure(D.errorType.GENERIC_ERROR);
        return;
    }
    
    const command = generateVeeamCmd();
    if (command === '') {
        console.error("No command generated - VM name is required");
        D.failure(D.errorType.GENERIC_ERROR);
        return;
    }
    
    instance.executeCommand(command)
        .then(instance.parseOutputToString)
        .then(parseOutput)
        .catch(instance.checkError);
}

// WinRM functions
function WinRMHandler() {
}

// Check for Errors on the command response
WinRMHandler.prototype.checkError = function (output) {
    // Check if the error message contains CSV data (PowerShell output in error message)
    if (output.message && output.message.includes(',Success,') && output.message.includes(',Backup Job')) {
        console.info("PowerShell command succeeded but WinRM returned error - extracting data from error message");
        // Extract the CSV data from the error message
        const lines = output.message.split('\n');
        let csvData = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.includes(',Success,') || line.includes(',Warning,') || line.includes(',Failed,')) {
                csvData += line + '\n';
            }
        }
        if (csvData) {
            parseOutput(csvData);
            return;
        }
    }
    
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
    const self = this;
    config.command = command;

    console.info("my console info command" + command);

    console.info("my console info config" + config);

    veeamDevice.sendWinRMCommand(config, function (output) {
        if (output.error) {
            // Check if error contains valid data before treating as failure
            if (output.error.message && output.error.message.includes(',Success,') && output.error.message.includes(',Backup Job')) {
                self.checkError(output.error);
                // Don't reject, as checkError will handle the data extraction
            } else {
                self.checkError(output.error);
                d.reject(output.error);
            }
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

WinRMHandler.prototype.parseOutputToString = function (output) {
    return output.outcome && output.outcome.stdout ? output.outcome.stdout : '';
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
    veeamDevice.sendSSHCommand(config, function (output, error) {
        if (error) {
            self.checkError(output, error);
            d.reject(error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

SSHHandler.prototype.parseOutputToString = function (output) {
    return output ? output : '';
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
} 