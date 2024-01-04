/**
 * Domotz Custom Driver 
 * Name: MikroTik Hardware Sensors
 * Description: This script retrieves hardware sensor data from MikroTik devices 
 * 
 * Communication protocol is ssh 
 * 
 * Tested with MikroTik RouterOS version: 7.13
 *
 * Creates a Custom Driver Variable with the retrieved hardware sensor data:
 *      - Switch Temperature: Temperature of the switch in degrees Celsius.
 *      - Board Temperature: Temperature of the board in degrees Celsius.
 *      - PSU 1 Status: Status of Power Supply Unit 1.
 *      - PSU 2 Status: Status of Power Supply Unit 2.
 *      - POE Output Consumption: Power over Ethernet output consumption in watts.
 */

// SSH command to retrieve system health information
var command = "system health print";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 5000
};

//Handle SSH errors
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255 || err.code == 1) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Execute SSH command and return a promise
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) {
            checkSshError(error);
            d.reject(error);
        } else {           
            d.resolve(output);      
        }
    });
    return d.promise;
}

// Parse system health data and create Custom Driver Variables
function parseData(output) {
    var lines = output.split("\n");
    var header = lines[1].trim().split(/\s+/);
    var nameIndex = header.indexOf("NAME");
    var valueIndex = header.indexOf("VALUE");
    var typeIndex = header.indexOf("TYPE");
    var variables = [];
    for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim().split(/\s+/);
        var name = line[nameIndex];
        var value = line[valueIndex];
        var unit = line[typeIndex];  
        
        if (name === "switch-temperature") {
            variables.push(D.createVariable(name, "Switch Temperature", value, unit, D.valueType.NUMBER));
        }
        if (name === "board-temperature1") {
            variables.push(D.createVariable(name, "Board Temperature", value, unit, D.valueType.NUMBER));
        }
        if (name === "psu1-state") {
            variables.push(D.createVariable(name, "PSU 1 Status", value, unit, D.valueType.STRING));
        }
        if (name === "psu2-state") {
            variables.push(D.createVariable(name, "PSU 2 Status", value, unit, D.valueType.STRING));
        }
        if (name === "poe-out-consumption") {
            variables.push(D.createVariable(name, "POE Output Consumption", value, unit, D.valueType.NUMBER));
        }
    } 
    D.success(variables);
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
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

function parseValidateOutput(output) {
    if (output.trim() !== "") {
        console.info("Validation successful");
    } 
}

/**
 * @remote_procedure
 * @label Get System health information
 * @documentation Retrieves hardware sensor data from MikroTik device
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}