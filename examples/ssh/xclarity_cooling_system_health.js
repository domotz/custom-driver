/**
 * Name: XClarity Cooling System Health
 * Description: This script can monitor cooling system health on Lenovo XClarity server
 *             
 * Communication protocol is SSH.
 * 
 * Tested under Lenovo XClarity version 8.42
 * 
 * Creates a Custom Driver table with the following columns:
 *      - ID (FAN): Identifier for the cooling system
 *      - Speed: Current speed of the cooling system
 *      - Speed (% of maximum): Speed of the cooling system as a percentage of the maximum speed
 *      - Status: Status of the cooling system 
 */

// Define the command to be executed on the XClarity server
var command = "syshealth cooling";

var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

// Create a custom table to store cooling system health information
var coolingSystemTable = D.createTable(
    "Cooling System Health",
    [
        { label: "Speed", unit: "RPM", valueType: D.valueType.NUMBER },
        { label: "Speed (% of maximum)", unit: "%", valueType: D.valueType.NUMBER },      
        { label: "Status", valueType: D.valueType.STRING },
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
 * @label Validate Cooling System Health
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
 * @label Get Cooling System Health Status
 * @documentation Retrieves and parses cooling system health information.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

// Parse and insert cooling system health data into the custom table
function parseData(output) {
    var lines = output.split("\n");
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 2; i < lines.length-1; i++) {
        var line = lines[i].trim();
        var values = line.split(/\s+/);
        var recordId = (values[0] + values[1] + "-" + values[2]).replace(recordIdSanitisationRegex, '').slice(0, 50);
        var speed = values[3];
        var speedMax = values[4];
        var status =  values[5]; 
        coolingSystemTable.insertRecord(
            recordId, [speed, speedMax , status]
        );
    }
    D.success(coolingSystemTable);
}