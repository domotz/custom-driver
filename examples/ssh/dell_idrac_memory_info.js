/**
 * Name: Dell iDRAC Memory Monitoring
 * Description: Monitors the operational status of memory on a Dell server with iDRAC
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
 *      - Bank Label
 *      - Model
 *      - Part Number
 *      - Serial Number
 *      - Manufacturer
 *      - Size (in bytes)
 *      - Speed (in MHz)
 *      - Current Operating Speed (in MHz)
 */

// SSH command to retrieve memory information
var command = "racadm hwinventory";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 100000,
    "keyboard_interactive": true,
};

// Custom Driver Table to store memory information
var table = D.createTable(
    "Memory Info",
    [
        { label: "Type", valueType: D.valueType.STRING},
        { label: "Description", valueType: D.valueType.STRING },
        { label: "Primary Status", valueType: D.valueType.STRING },
        { label: "Bank Label", valueType: D.valueType.STRING },
        { label: "Model", valueType: D.valueType.STRING },
        { label: "Part Number", valueType: D.valueType.STRING },
        { label: "Serial Number", valueType: D.valueType.STRING },
        { label: "Manufacturer", valueType: D.valueType.STRING },
        { label: "Size", unit: "B", valueType: D.valueType.NUMBER },
        { label: "Speed", unit: "MHZ", valueType: D.valueType.NUMBER },      
        { label: "Current Operating Speed", unit: "MHZ", valueType: D.valueType.NUMBER }       
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
 * @label Get Memory Info
 * @documentation Retrieves operational status of memory modules on a Dell server with iDRAC.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

// Parse memory information output
function parseData(output) {
    var lines = output.split("\n");
    var data = {};
    var instanceIdDimm = false; 
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("[InstanceID: DIMM.") >= 0) {
            instanceIdDimm = true;
            data = {}; 
        } else if (instanceIdDimm && line.length === 0) {
            var recordId = (data["InstanceID"]).replace(recordIdSanitisationRegex, '').slice(0, 50);
            var type = data["Device Type"] || "-"; 
            var description = data["DeviceDescription"] || "-";
            var primaryStatus = data["PrimaryStatus"] || "-";
            var bankLabel = data["BankLabel"] || "-";
            var model = data["Model"] || "-";
            var partNumber = data["PartNumber"] || "-";
            var serialNumber = data["SerialNumber"] || "-";
            var manufacturer = data["Manufacturer"] || "-";
            var size = (data["Size"] || "").replace(/\D+/g, "") || "-";
            var sizeInBytes = size * Math.pow(1024, 2);
            var speed = (data["Speed"] || "").replace(/\D+/g, "") || "-";
            var currentOperatingSpeed = (data["CurrentOperatingSpeed"] || "").replace(/\D+/g, "") || "-";
            table.insertRecord(
                recordId, [
                    type,
                    description,
                    primaryStatus,
                    bankLabel,
                    model,
                    partNumber,
                    serialNumber,
                    manufacturer,
                    sizeInBytes,
                    speed,
                    currentOperatingSpeed
                ]
            );
            data = {};
            instanceIdDimm = false;
        } else if (instanceIdDimm) {
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