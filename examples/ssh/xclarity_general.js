/**
 * Name: XClarity General/Health Monitoring
 * Description: This script retrieves general and health information from Lenovo XClarity server.
 *             
 * Communication protocol is SSH.
 * 
 * Tested under Lenovo XClarity version 8.42
 * 
 * Creates a Custom Driver variables:
 *      - State: The current state of the system
 *      - Restarts: The number of system restarts or reboots
 *      - Cooling Devices: Cooling devices and their status
 *      - Local Storage: Local storage devices and their status
 *      - Processors: Processors in the system
 *      - Memory: Memory and its configuration
 *      - System: General system information and status     
 * 
 */

var command = "syshealth summary";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

//Handle SSH errors
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Execute SSH command and return a promise
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
 * @label Validate Association
 * @documentation This procedure validates if the driver can be applied to a device during association and validates provided credentials.
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
 * @label Get General Health Info 
 * @documentation Retrieves general health information from Lenovo XClarity.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

function parseData(output) {
    var lines = output.split("\n");   
    var variables = [];   
    for (var i = 0; i < lines.length; i++) {     
        var state = lines[i].match(/State\s+(.*)/);
        var restarts = lines[i].match(/Restarts\s+(.*)/);
        var coolingDevices = lines[i].match(/Cooling Devices\s+(.*)/);
        var localStorage = lines[i].match(/Local Storage\s+(.*)/);
        var processors = lines[i].match(/Processors\s+(.*)/);
        var memory = lines[i].match(/Memory\s+(.*)/);
        var system = lines[i].match(/System\s+(.*)/); 
        if (state) variables.push(D.createVariable("state", "State", state[1], null, D.valueType.STRING));
        if (restarts) variables.push(D.createVariable("restarts", "Restarts", restarts[1], null, D.valueType.NUMBER));
        if (coolingDevices) variables.push(D.createVariable("cooling_devices", "Cooling Devices", coolingDevices[1], null, D.valueType.STRING));
        if (localStorage) variables.push(D.createVariable("local_storage", "Local Storage", localStorage[1], null, D.valueType.STRING) );
        if (processors) variables.push(D.createVariable("processors", "Processors", processors[1], null, D.valueType.STRING));
        if (memory) variables.push(D.createVariable("memory", "Memory", memory[1], null, D.valueType.STRING));
        if (system) variables.push(D.createVariable("system", "System", system[1], null, D.valueType.STRING));
    }
    D.success(variables);
}
