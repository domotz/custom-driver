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
 *      - FQDD
 *      - Device Type
 *      - Device Description
 *      - Primary Status
 *      - Bank Label
 *      - Model
 *      - Part Number
 *      - Serial Number
 *      - Manufacturer
 *      - Size (in bytes)
 *      - Speed (in MHz)
 *      - Current Operating Speed (in MHz)
 * 
 */

// SSH command to retrieve memory information
var command = "racadm hwinventory";

// SSH options when running the command
var sshConfig = {
    "timeout": 100000,
    "keyboard_interactive": true
};

// Custom Driver Table to store memory information
var table = D.createTable(
    "Memory Info",
    [
        { label: "FQDD" },
        { label: "Device Type" },
        { label: "Device Description" },
        { label: "Primary Status" },
        { label: "Bank Label" },
        { label: "Model" },
        { label: "Part Number" },
        { label: "Serial Number" },
        { label: "Manufacturer" },
        { label: "Size", unit: "B" },
        { label: "Speed", unit: "MHZ" },      
        { label: "Current Operating Speed", unit: "MHZ" }            
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
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("[InstanceID: DIMM.") >= 0) {
            instanceIdDimm = true;
            data = {}; 
        } else if (instanceIdDimm && line.length === 0) {
            var recordId = D.crypto.hash((data["InstanceID"]), "sha256", null, "hex").slice(0, 50);
            var fqdd = data["FQDD"] || "-"; 
            var deviceType = data["Device Type"] || "-"; 
            var deviceDescription = data["DeviceDescription"] || "-";
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
                    fqdd,
                    deviceType,
                    deviceDescription,
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