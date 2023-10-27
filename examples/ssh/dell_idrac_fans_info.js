/**
 * Name: Dell iDRAC Fan Monitoring
 * Description: Monitors the operational status of fans on a Dell server with iDRAC
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
 *      - Type
 *      - Description
 *      - Primary Status
 *      - Redundancy Status
 *      - Active Cooling
 *      - Variable Speed
 *      - PWM
 *      - Current Reading
 */

// SSH command to retrieve fan information
var command = "racadm hwinventory";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true
};

// Custom Driver Table to store fan information
var table = D.createTable(
    "Fans Info",
    [
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Description", valueType: D.valueType.STRING },
        { label: "Primary Status", valueType: D.valueType.STRING },
        { label: "Redundancy Status", valueType: D.valueType.STRING },
        { label: "Active Cooling", valueType: D.valueType.STRING },
        { label: "Variable Speed", valueType: D.valueType.STRING },
        { label: "PWM", unit: "%", valueType: D.valueType.NUMBER },
        { label: "Current Reading", unit: "RPM", valueType: D.valueType.NUMBER }      
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
 * @label Get Fan Info
 * @documentation Retrieves operational status of fans on a Dell server with iDRAC.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

// Parse fan information output
function parseData(output) {
    var lines = output.split("\n");
    var data = {};
    var instanceIdFan = false; 
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("[InstanceID: Fan.") >= 0) {
            instanceIdFan = true;
            data = {}; 
        } else if (instanceIdFan && line.length === 0) {
            var recordId = (data["InstanceID"]).replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
            var type = data["Device Type"] || "-"; 
            var description = data["DeviceDescription"] || "-";
            var primaryStatus = data["PrimaryStatus"] || "-";
            var redundancyStatus = data["RedundancyStatus"] || "-";
            var activeCooling = data["ActiveCooling"] || "-";
            var variableSpeed = data["VariableSpeed"] || "-";
            var pwm = (data["PWM"] || "").replace("%", "") || "-";
            var currentReading = (data["CurrentReading"] || "").replace(/\D+/g, "") || "-";
            table.insertRecord(
                recordId, [
                    type,
                    description,
                    primaryStatus,
                    redundancyStatus,
                    activeCooling,
                    variableSpeed,
                    pwm,
                    currentReading
                ]
            );
            data = {};
            instanceIdFan = false;
        } else if (instanceIdFan) {
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