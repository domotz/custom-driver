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
 *      - Page Faults: The value of the "Database Page Faults/sec" counter, representing the rate of page faults per second
 *      - Page Fault Stalls: The value of the "Database Page Fault Stalls/sec" counter, representing the rate of page fault stalls per second
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

var table = D.createTable(
    "Database Page Faults",
    [
        { label: "Instance Name", type: D.valueType.STRING },
        { label: "Page faults", unit: "rate/s", type: D.valueType.NUMBER },
        { label: "Page fault stalls", unit: "rate/s", type: D.valueType.NUMBER }
    ]
);

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
 * @documentation This procedure retrieves the current Database Page Faults of the Microsoft Exchange Server by querying performance counters
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
        var jsonOutput = JSON.parse(output.outcome.stdout);
        var data = {};
        for (var i = 0; i < jsonOutput.length; i++) {
            var instanceName = jsonOutput[i].InstanceName;
            var cookedValue = jsonOutput[i].CookedValue;
            var path = jsonOutput[i].Path;
            if (path.indexOf("database page faults") !== -1) {
                data[instanceName] = data[instanceName] || {};
                data[instanceName].pageFaults = cookedValue;
            } else if (path.indexOf("database page fault stalls") !== -1) {
                data[instanceName] = data[instanceName] || {};
                data[instanceName].pageFaultStalls = cookedValue;
            }
        }

        for (instanceName in data) {
            console.debug("Instance Name is" + instanceName);
            var recordId = sanitize(instanceName.replace(" - ", "-"));
            var instanceData = data[instanceName];
            table.insertRecord(recordId, [instanceName, instanceData.pageFaults, instanceData.pageFaultStalls ]);
        }
        D.success(table);
    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}