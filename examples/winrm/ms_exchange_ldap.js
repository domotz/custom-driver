/**
 * Domotz Custom Driver 
 * Name: Microsoft Exchange Server - LDAP (Lightweight Directory Access Protocol) Read / Search Time
 * Description: This script is used to monitor LDAP (Lightweight Directory Access Protocol) read and search times on a Microsoft Exchange Server
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
 *      - Instance Name: Instance name of the LDAP operation
 *      - LDAP Read Time: The value of the "LDAP Read Time" counter, representing the time taken for LDAP read operations
 *      - LDAP Search Time: The value of the "LDAP Search Time" counter, representing the time taken for LDAP search operations
 * 
 */

// List of performance counters to monitor
var counters = [
    "\\MSExchange ADAccess Domain Controllers(*)\\LDAP Read Time", 
    "\\MSExchange ADAccess Domain Controllers(*)\\LDAP Search Time"
];

// WinRM configuration
var winrmConfig = {
    "command": 'Get-Counter -Counter ' + counters.map(function(counter){return '"' + counter + '"';}).join(',') + ' | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json',
    "username": D.device.username(),
    "password": D.device.password()
};

var table = D.createTable(
    "LDAP Read and Search Time",
    [
        { label: "Instance Name", type: D.valueType.STRING },
        { label: "LDAP Read Time", type: D.valueType.NUMBER },
        { label: "LDAP Search Time", type: D.valueType.NUMBER }
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
 * @documentation This procedure is used to validate the driver and credentials provided during association with the Microsoft Exchange Server
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
 * @label Get LDAP Read and Search Time
 * @documentation This procedure retrieves the current LDAP read and search times on the Microsoft Exchange Server by querying performance counters.
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
            if (path.indexOf("ldap read time") !== -1) {
                data[instanceName] = data[instanceName] || {};
                data[instanceName].ldapReadTime = cookedValue;
            } else if (path.indexOf("ldap search time") !== -1) {
                data[instanceName] = data[instanceName] || {};
                data[instanceName].ldapSearchTime = cookedValue;
            }
        }

        for (instanceName in data) {
            var recordId = sanitize(instanceName);
            var instanceData = data[instanceName];
            table.insertRecord(recordId, [instanceName, instanceData.ldapReadTime, instanceData.ldapSearchTime ]);
        }

        D.success(table);
    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}