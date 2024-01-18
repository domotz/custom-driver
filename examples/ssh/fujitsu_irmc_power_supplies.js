/**
 * Domotz Custom Driver 
 * Name: Fujitsu iRMC Power Supplies
 * Description: Monitors the status of power supplies in a Fujitsu iRMC system.
 * 
 * Communication protocol is SSH.
 * 
 * Tested under Fujitsu iRMC version : RX2530 M4
 * 
 * Creates a Custom Driver table to store the status of power supplies for Fujitsu devices
 *  
 */

// Commands to be executed over SSH to retrieve information
var commands = ["3","p","\n","p","\n","p","\n","p","\n"];

// Custom Driver table to store Power Supply Status
var table = D.createTable(
    "Power Supply Info",
    [
        { label: "Status", valueType: D.valueType.STRING }
    ]
);

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
 * If the desired output is not found in the current response, the SSH command is re-executed until the desired output is found
 * @returns {Promise} A promise resolving to the last command output
 */
function executeCommand() {
    var d = D.q.defer();
    var sshConfig = {
        "username": D.device.username(),
        "password": D.device.password(),
        "commands": commands, 
        "prompt_regex": /(quit: |Press any key to continue $)/,
        "timeout": 5000
    };  

    function execute() {
        D.device.sendSSHCommands(sshConfig, function (out, err) {
            if (err) {
                checkSshError(err);
                d.reject(err);
            } else {
                if (!out || out.length === 0) {
                    console.error("No output received");
                    D.failure(D.errorType.PARSING_ERROR);
                } else {
                    var output = JSON.stringify(out);
                    if (output.indexOf("Press any key to continue") !== -1) {
                        console.log("Desired output found");
                        d.resolve(output);
                    } else {
                        execute();
                    }
                }
            }
        });
    }
    execute();
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, "").slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant information from the command output and populates the Custom Driver Table
function extractPowerSupplyInfo(output) {
    if (!output || output.length === 0) {
        D.failure(D.errorType.PARSING_ERROR);
        return;
    }

    var cleanedOutput = output.replace(/\\u001b\[[0-9;]*[a-zA-Z]/g, "").split("\\r\\r\\n");
    var tableStartIndex = -1;
    var tableEndIndex = -1;

    for (var k = 0; k < cleanedOutput.length; k++) {
        if (cleanedOutput[k].indexOf("Sensor Name") !== -1) {
            tableStartIndex = k + 2; 
            break;
        }
    }

    if (tableStartIndex !== -1) {
        for (var i = tableStartIndex; i < cleanedOutput.length; i++) {
            if (cleanedOutput[i].trim() === "") {
                tableEndIndex = i;
                break;
            }
        }

        if (tableEndIndex === -1) {
            tableEndIndex = cleanedOutput.length;
        }

        var tableLines = cleanedOutput.slice(tableStartIndex, tableEndIndex);

        for (var j = 0; j < tableLines.length; j++) {
            var line = tableLines[j];
            var match = line.match(/^(.*?)\s*\|\s*(.*?)$/);
            if (match) {
                var sensorName = match[1].trim();
                var recordId = sanitize(sensorName);
                var status = match[2].trim().replace(/^Power supply - /, "");
                table.insertRecord(recordId, [status]);
            }
        }
        D.success(table);
    } else {
        console.error("Power supply information not found in the output");
    }
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
 * @label Get Power supplies information
 * @documentation This procedure is used to extract power supplies information from Fujitsu iRMC.
 */
function get_status() {
    executeCommand()
        .then(extractPowerSupplyInfo)
        .then(checkSshError);
}