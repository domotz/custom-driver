/**
 * Name: XClarity Temperatures 
 * Description: This script can monitor temperature information on a Lenovo XClarity server
 *             
 * Communication protocol is SSH.
 * 
 * Tested under Lenovo XClarity version 8.42
 * 
 * Creates a Custom Driver table with the following columns:
 *      - Temperature F: Current value in Fahrenheit 
 *      - Temperature C: Current value in Celsius
 *      - Warning Reset: Positive-going Threshold Hysteresis value
 *      - Warning: Upper non-critical Threshold
 *      - Soft Shutdown: Upper critical Threshold
 *      - Hard Shutdown: Upper non-recoverable Threshold
 */

// Define the command to be executed on the XClarity server
var command = "temps";

var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

// Create a custom table to store temperature information
var temperaturesTable = D.createTable(
    "Temperatures",
    [
        { label: "Temperature F", unit: "F", valueType: D.valueType.NUMBER },
        { label: "Temperature C", unit: "C", valueType: D.valueType.NUMBER },
        { label: "Warning Reset", valueType: D.valueType.STRING },      
        { label: "Warning", valueType: D.valueType.STRING },
        { label: "Soft Shutdown", valueType: D.valueType.STRING },
        { label: "Hard Shutdown", valueType: D.valueType.STRING }
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
    if (output && output.indexOf("Error: Command not recognized") !== -1) {
        console.info("Validation failed: Command not supported");
        D.failure(D.errorType.PARSING_ERROR);
    }else {
        console.info("Validation successful: Command is supported");
    }
}


/**
 * @remote_procedure
 * @label Get Temperature Information
 * @documentation Retrieves and parses temperature information from the server.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

// Parse and insert temperature data into the custom table
function parseData(output) {
    var lines = output.split("\n");
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 3; i < lines.length-1; i++) {
        var line = lines[i].trim();
        var parts = line.split(/\s+/);
        var temperature = parts.slice(-3)[0];
        var temps = temperature.split('/');
        var temperatureFahrenheit = parseFloat(temps[0]);
        var temperatureCelsius = parseFloat(temps[1]);
        var warningReset = parts.slice(-5)[0];
        var warning = parts.slice(-4)[0];
        var softShutdown = parts.slice(-2)[0];
        var hardShutdown = parts.slice(-1)[0];
        var name = (parts.slice(0, -5).join(" "));
        var recordId = name.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
        temperaturesTable.insertRecord(
            recordId, [temperatureFahrenheit.toFixed(0), temperatureCelsius.toFixed(0), warningReset, warning, softShutdown, hardShutdown]
        );
    }
    D.success(temperaturesTable);
}

