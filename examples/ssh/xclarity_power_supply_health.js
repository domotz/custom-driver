/**
 * Name: XClarity Power Supply Health
 * Description: This script monitors the health status of power supplies on Lenovo XClarity server.
 *         
 * Communication protocol is SSH.
 * 
 * Tested under Lenovo XClarity version 8.42
 * 
 * Creates a Custom Driver table with the following columns:
 *      - ID (Name): The identifier of each power supply
 *      - Status: The current status of each power supply
 *      - Rated Power: The rated power of each power supply
 */

// Define the command to be executed on the XClarity server
var command = "syshealth power";

var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

// Create a custom table to store power supply health information
var powerTable = D.createTable(
    "Power Supply Health Info",
    [
        { label: "Status", valueType: D.valueType.STRING},
        { label: "Rated Power", unit: "W", valueType: D.valueType.NUMBER },      
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
 * @remote_procedure
 * @label Validate connection
 * @documentation Validates the SSH connection and command execution
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
 * @label Get Power Supply Health Status
 * @documentation Retrieves and parses power supply health information.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

// Parse and insert power supply health data into the custom driver table
function parseData(output) {
    var lines = output.split("\n");
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 2; i < lines.length-1; i++) {
        var line = lines[i].trim();
        var values = line.split(/\s+/);
        var recordId = (values[0] + "-" + values[1] + values[2]).replace(recordIdSanitisationRegex, '').slice(0, 50);
        var status =  values[3]; 
        var ratedPower =  values[4]; 
        powerTable.insertRecord(
            recordId, [status, ratedPower]
        );
    }
    D.success(powerTable);
}