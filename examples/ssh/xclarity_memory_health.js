/**
 * Name: XClarity Memory Health
 * Description: This script can monitor memory health on Lenovo XClarity servers.
 *             
 * Communication protocol is SSH.
 * 
 * Tested under Lenovo XClarity version 8.42
 * 
 * Keyboard Interactive option: true/false (depends on XClarity version).
 * 
 * Creates a Custom Driver table with the following columns:
 *      - ID (FRU Name): The identifier for the memory
 *      - Status: The current health status of the memory
 *      - Type: The type or model of the memory 
 *      - Capacity: The total capacity of the memory
 * 
 */

// Define the command to be executed on the XClarity server
var command = "syshealth memory";

var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

// Create a custom table to store memory health information
var memoryHealthTable = D.createTable(
    "Memory Health Info",
    [
        { label: "Status", valueType: D.valueType.STRING},
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Capacity", unit: "GB", valueType: D.valueType.NUMBER },      
    ]
);

// Function to handle SSH errors and failure cases
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Function to execute an SSH command
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, err) {
        if (err) {
            checkSshError(err);
        } else {
            d.resolve(output);
        }                  
    });
    return d.promise;
}

/**
 * 
 * @remote_procedure
 * @label Validate Memory Health
 * @documentation Validates the connection and command execution
 */
function validate() {
    executeCommand(command)
        .then(parseValidateOutput)
        .then(D.success)
        .catch(checkSshError);
}

function parseValidateOutput(output) {
    if (output.trim() !== "") {
        console.info("Validation successful");
    } 
}

/**
 * @remote_procedure
 * @label Get Memory Health Status
 * @documentation Retrieves and parses memory health information.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

// Parse and insert memory health data into the custom table
function parseData(output) {
    var lines = output.split("\n");
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 2; i < lines.length-1; i++) {
        var line = lines[i].trim();
        var values = line.split(/\s+/);
        var recordId = (values[0] + " " + values[1]).replace(recordIdSanitisationRegex, '').slice(0, 50);
        var status =  values[2]; 
        var type = values[3];
        var capacity = parseInt(values[4]);
        memoryHealthTable.insertRecord(
            recordId, [status, type, capacity]
        );
    }
    D.success(memoryHealthTable);
}