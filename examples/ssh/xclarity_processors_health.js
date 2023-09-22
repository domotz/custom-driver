/**
 * Name: XClarity Processors Health
 * Description: This script can monitor processors health on Lenovo XClarity servers.
 *             
 * Communication protocol is SSH.
 * 
 * Tested under Lenovo XClarity version 8.42
 * 
 * Keyboard Interactive option: true/false (depends on XClarity version).
 * 
 * Creates a Custom Driver table with the following columns:
 *      - ID (FRU Name): The identifier of the processor
 *      - Status: The health status of the processor
 *      - Clock Speed: The clock speed of the processor
 * 
 */

// Define the command to be executed on the XClarity server
var command = "syshealth processors";

var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

// Create a custom table to store processors health information
var processorHealthTable = D.createTable(
    "Processors Health Info",
    [
        { label: "Status", valueType: D.valueType.STRING},
        { label: "Clock Speed", unit: "MHz", valueType: D.valueType.NUMBER },      
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
 * @label Validate Processors Health
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
 * @label Get Processors Health Status
 * @documentation Retrieves and parses processors health information.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

// Parse and insert processors health data into the custom table
function parseData(output) {
    var lines = output.split("\n");
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 2; i < lines.length-1; i++) {
        var line = lines[i].trim();
        var values = line.split(/\s+/);
        var recordId = (values[0] + "-" + values[1]).replace(recordIdSanitisationRegex, '').slice(0, 50);
        var status =  values[2]; 
        var clockSpeed = parseInt(values[3]);
        processorHealthTable.insertRecord(
            recordId, [status, clockSpeed]
        );
    }
    D.success(processorHealthTable);
}