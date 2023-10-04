/**
 * Name: Dell iDRAC PSU Monitoring
 * Description: Monitors the operational status of Power Supply Units (PSUs) on a Dell server with iDRAC
 * 
 * Communication protocol is SSH.
 * 
 * Tested under iDRAC version 7.0.3 21053776 U3 P70
 * 
 * Keyboard Interactive option: true/false (depends on iDRAC version).
 * 
 * Timeout: should be set to 120 seconds
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Description
 *      - Primary Status
 *      - Total Output Power     
 *      - Input Voltage      
 *      - Redundancy Status
 *      - Part Number
 *      - Model
 *      - Manufacturer
 */

// SSH command to retrieve PSU information
var command = "racadm hwinventory";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

// Custom Driver Table to store PSU information
var table = D.createTable(
    "PSU Info",
    [
        { label: "Description", valueType: D.valueType.STRING },
        { label: "Primary Status", valueType: D.valueType.STRING },
        { label: "Total Output Power", unit: "W", valueType: D.valueType.NUMBER },      
        { label: "Input Voltage", unit: "V", valueType: D.valueType.NUMBER },      
        { label: "Redundancy Status", valueType: D.valueType.STRING },
        { label: "Part Number", valueType: D.valueType.STRING },
        { label: "Model", valueType: D.valueType.STRING },
        { label: "Manufacturer", valueType: D.valueType.STRING }
    ]
);

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
            if (output && output.indexOf("COMMAND NOT RECOGNIZED")!==-1) {
                D.failure(D.errorType.PARSING_ERROR);
            } else {
                d.resolve(output);
            }           
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
    if (output.trim() !== "") {
        console.info("Validation successful");
    } 
}

/**
 * @remote_procedure
 * @label Get PSU Info
 * @documentation Retrieves operational status of Power Supply Units (PSUs) on a Dell server with iDRAC.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}

// Parse cpu information output
function parseData(output) {
    var lines = output.split("\n");
    var data = {};
    var instanceIdPsu = false; 
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("[InstanceID: PSU.Slot.") >= 0) {
            instanceIdPsu = true;
            data = {}; 
        } else if (instanceIdPsu && line.length === 0) {
            var recordId = (data["InstanceID"]).replace(recordIdSanitisationRegex, '').slice(0, 50);
            var description = data["DeviceDescription"] || "-"; 
            var primaryStatus = data["PrimaryStatus"] || "-"; 
            var totalOutputPower = (data["TotalOutputPower"] || "").replace(/\D+/g, "") || "-";
            var inputVoltage = (data["InputVoltage"] || "").replace(/\D+/g, "") || "-";
            var redundancyStatus = data["RedundancyStatus"] || "-"; 
            var partNumber = data["PartNumber"] || "-"; 
            var model = data["Model"] || "-"; 
            var manufacturer = data["Manufacturer"] || "-";            
            table.insertRecord(
                recordId, [
                    description,
                    primaryStatus,
                    totalOutputPower,
                    inputVoltage,
                    redundancyStatus,
                    partNumber,
                    model,
                    manufacturer
                ]
            );
            data = {};
            instanceIdPsu = false;
        } else if (instanceIdPsu) {
            var keyValue = line.split('=');
            if (keyValue.length === 2) {
                var key = keyValue[0].trim();
                var value = keyValue[1].trim();
                data[key] = value;
            }
        }
    }
    D.success(table);
}