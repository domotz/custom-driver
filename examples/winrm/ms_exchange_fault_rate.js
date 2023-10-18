/**
 * Domotz Custom Driver 
 * Name: Microsoft Exchange Server - Fault Rate
 * Description: This script is used to monitor database Fault rates from a Microsoft Exchange Server
 * 
 * Communication protocol is WinRM
 * 
 * Tested on:
 *      - Microsoft Exchange Server 2019 CU12
 * 
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver Table with the following columns:
 *      - Instance Name: Instance name of the database
 *      - Value: Value of the counter
 * 
 */

// List of performance counters to monitor
var counters = [
    "\\MSExchange Database(*)\\Database Page Fault Stalls/sec",
    "\\MSExchange Database(*)\\Database Page Faults/sec"
];

// Define winrm configuration
var winrmConfig = {
    "command": 'Get-Counter -Counter ' + counters.map(function(counter){return '"' + counter + '"';}).join(',') + ' | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json',
    "username": D.device.username(),
    "password": D.device.password()
};

// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * @remote_procedure
 * @label Validate WinRM connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate() {
    console.log("Validating WinRM connectivity...");
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            console.log("Validation successful");
            D.success();
        } else {
            console.error("Validation failed");
            checkWinRmError(output.error);
        }
    });
}

/**
 * @remote_procedure
 * @label Get Database Fault rates
 * @documentation This procedure retrieves the current fault rates of the Microsoft Exchange Server by querying performance counters
 */
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}


function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Parses the output of the WinRM command and extracts data
function parseOutput(output) {
    if (output.error === null) {
        var k = 0;
        var variables = [];
        var jsonOutput = JSON.parse(output.outcome.stdout);
        while (k < jsonOutput.length) {
            var path = jsonOutput[k].Path;
            var instanceName = jsonOutput[k].InstanceName || "-";
            var value = jsonOutput[k].CookedValue;

            if (path.indexOf("stalls") !== -1) {
                instanceName += " (Fault Stalls)";
            } else {
                instanceName += " (Faults)";
            }

            var uid = sanitize(instanceName);
            variable = D.device.createVariable(uid, instanceName, value, "", D.valueType.NUMBER);
            variables.push(variable);
            k++;
        }
        D.success(variables);
    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}
