/**
 * Name: XClarity Storage Health
 * Description:This script monitors the health status of storage systems on Lenovo XClarity server 
 *             
 * Communication protocol is SSH.
 * 
 * Tested under Lenovo XClarity version 8.42
 * 
 * Creates a Custom Driver Variables for the status of the storage system
 */

// Define the command to be executed on the XClarity server
var command = "syshealth storage";

var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

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
    if (output && output.indexOf("Error: Command not recognized") !== -1) {
        console.info("Validation failed: Command not supported");
        D.failure(D.errorType.PARSING_ERROR);
    }else {
        console.info("Validation successful: Command is supported");
    }
}

/**
 * @remote_procedure
 * @label Get Storage Health Status
 * @documentation Retrieves and parses storage health information
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

// Parse and insert storage health data into the custom driver variables
function parseData(output) {
    var cleanedOutput = output.replace(/Flash DIMMs[\s\S]*$/, '');
    var lines = cleanedOutput.split("\n");
    var drivesData = [];
    for (var i = 3; i < lines.length-2; i++) {
        var line = lines[i].trim();
        var parts = line.split(/\s+/);
        var fruName = parts.slice(0, -1).join(" "); // The FRU (Field Replaceable Unit) name
        var status = parts.slice(-1)[0]; 
        var identifier =  fruName.replace(/ /g, '-').toLowerCase();
        drivesData.push(D.createVariable(identifier, fruName, status, null, D.valueType.STRING ));
    }
    D.success(drivesData);
}