/**
 * Name: Dell iDRAC RAID Monitoring
 * Description: Monitors the operational status of RAID controllers on a Dell server with iDRAC.
 * 
 * Communication protocol is SSH.
 * 
 * Tested under iDRAC version 7.0.3 21053776 U3 P70
 * 
 * Keyboard Interactive option: true/false (depends on iDRAC version).
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Device Type
 *      - Primary Status
 *      - Product Name
 *      - Device Description
 *      - Support RAID10 Uneven Spans
 *      - Cache Size
 *      - Driver Version
 *      - Encryption Mode
 *      - Security Status
 */

var command = "racadm hwinventory";

// SSH options when running the commands
var sshConfig = {
    "prompt": "#",
    "timeout": 40000,
    "keyboard_interactive": true
};

// SSH promise definition
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

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

// Custom Driver Table to store RAID controller information
var table = D.createTable(
    "RAID Info",
    [
        { label: "Device Type" },
        { label: "Primary Status" },
        { label: "Product Name" },
        { label: "Device Description" },
        { label: "Support RAID10 Uneven Spans" },
        { label: "Cache Size"},
        { label: "Driver Version" },
        { label: "Encryption Mode" },
        { label: "Security Status" }        
    ]
);

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
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
* @label Get RAID Infos
* @documentation Retrieves operational status of RAID controllers on a Dell server with iDRAC.
*/
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

function parseData(output) {
    var lines = output.split("\n");
    var data = {};
    var instanceIdRaid = false; // Flag to indicate if InstanceID: RAID is found
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("[InstanceID: RAID.") >= 0) {
            instanceIdRaid = true;
            data = {}; 
        } else if (instanceIdRaid && line.length === 0) {
            if (Object.keys(data).length > 0) {
                var recordId = (data["InstanceID"] + "_" + data["Device Type"]).substring(0, 50);
                var deviceType = data["Device Type"] || "-"; 
                var primaryStatus = data["PrimaryStatus"] || "-";
                var productName = data["ProductName"] || "-";
                var deviceDescription = data["DeviceDescription"] || "-";
                var supportRAID10UnevenSpans = data["SupportRAID10UnevenSpans"] || "-";
                var cacheSizeInMB = data["CacheSizeInMB"] || "-";
                var driverVersion = data["DriverVersion"] || "-";
                var encryptionMode = data["EncryptionMode"] || "-";
                var securityStatus = data["SecurityStatus"] || "-";
                table.insertRecord(
                    recordId, [
                        deviceType,
                        primaryStatus,
                        productName,
                        deviceDescription,
                        supportRAID10UnevenSpans,
                        cacheSizeInMB,
                        driverVersion,
                        encryptionMode,
                        securityStatus
                    ]
                );
                data = {};
                instanceIdRaid = false;
            }
        } else if (instanceIdRaid) {
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