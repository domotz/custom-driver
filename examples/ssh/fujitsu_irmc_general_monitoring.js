/**
 * Domotz Custom Driver 
 * Name: Fujitsu iRMC General Monitoring
 * Description: Monitors the general information for Fujitsu iRMC (Integrated Remote Management Controller) systems
 * 
 * Communication protocol is SSH.
 * 
 * Tested under Fujitsu iRMC version : RX2530 M4
 * 
 * Creates a Custom Driver variables
 *      - iRMC Version: iRMC version information
 *      - Serial Number: Serial number of the device
 *      - System Type: Type of the device
 *      - System OS: Operating system information of the device
 *      - System Status: Status information of the device
 */

// Commands to be executed over SSH to retrieve information
var commands = ["1","0"];

// Checks for SSH execution errors
function checkSshError(error) {
    if (error) {
        console.error("Error: ", error);
        if (error.message && (error.message.indexOf("All configured authentication methods failed") !== -1) ) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    }
}

/**
 * Executes the SSH commands and returns a promise.
 * @returns {Promise} A promise resolving to the last command output
 */
function executeCommand() {
    var d = D.q.defer();
    var sshConfig = {
        "username": D.device.username(),
        "password": D.device.password(),
        "timeout": 5000,
        "prompt": "quit:",
        "commands": commands
    };
    D.device.sendSSHCommands(sshConfig, function (out, err) {
        if (err) {
            console.error("Command execution error: " + JSON.stringify(err));
            checkSshError(err);
            d.reject(err);
        } else {
            if(!out || out.length == 0){
                console.error("No output received");
                D.failure(D.errorType.PARSING_ERROR);
            } else {
                var lastCommandOutput = out[out.length - 1];
                d.resolve(JSON.stringify(lastCommandOutput));   
            }       
        }
    });
    return d.promise;
}

//  Extracts relevant information from the command output and creates variables.
function extractInfo(output) {
    if(!output || output.length == 0){
        D.failure(D.errorType.PARSING_ERROR);
    }

    var cleanedOutput = output.replace(/\\u001b\[[0-9;]*[a-zA-Z]/g, "");
    var lines = cleanedOutput.split("\n");
    var irmcVersion, systemType, serialNumber, systemOS, systemStatus;

    lines.forEach(function (line) {
        var result = line.replace(/\*/g, "").split("\\r\\n");
        irmcVersion = result[2].trim() + ' ' + result[3].trim();
        serialNumber = result[8].split(":")[1].trim();
        systemType = result[7].split(":")[1].trim();
        systemOS = result[10].split(":")[1].trim();
        systemStatus = result[11].split(":")[1].trim().replace(/\([^)]*\)/, "");
    });

    var variables = [
        D.createVariable("irmc-version", "iRMC Version", irmcVersion, null, D.valueType.STRING),
        D.createVariable("serial-number", "Serial Number", serialNumber, null, D.valueType.STRING),
        D.createVariable("system-type", "System Type", systemType, null, D.valueType.STRING),
        D.createVariable("system-os", "System OS", systemOS, null, D.valueType.STRING),
        D.createVariable("system-status", "System Status", systemStatus, null, D.valueType.STRING)
    ];

    D.success(variables);
}


/**
 * @remote_procedure
 * @label Validate Fujitsu device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    executeCommand()
        .then(function (output){
            if (output.length > 0) {
                console.info("Validation successful");
            }
        })
        .then(D.success)
        .catch(checkSshError);
}

/**
 * @remote_procedure
 * @label Get Fujitsu information
 * @documentation This procedure is used to extract information about the Fujitsu iRMC device, including iRMC version, serial number, system type, system OS, and system status.
 */
function get_status() {
    executeCommand()
        .then(extractInfo)
        .catch(checkSshError);
}