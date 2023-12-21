/**
 * Name: Dell iDRAC Physical Disk Monitoring
 * Description: Monitors the operational status of physical disks on a Dell server with iDRAC.
 * 
 * Communication protocol is SSH.
 * 
 * Tested under iDRAC version 7.0.3 21053776 U3 P70
 * 
 * Keyboard Interactive option: true/false (depends on iDRAC version).
 * 
 * Creates a Custom Driver Table with the following columns:
 *      - Type
 *      - Description
 *      - Primary Status
 *      - RAID Status
 *      - RAID Types
 *      - Size
 *      - Usage
 *      - Used Size
 *      - Free Size
 *      - Manufacturer
 *      - Model
 *      - Bus Protocol
 */

// SSH command to retrieve hardware inventory
var command = "racadm hwinventory";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000,
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

// Custom Driver Table to store physical disk information
var table = D.createTable(
    "Physical Disks Info",
    [
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Description", valueType: D.valueType.STRING },
        { label: "Primary Status", valueType: D.valueType.STRING },
        { label: "Raid Status", valueType: D.valueType.STRING },
        { label: "Raid Types", valueType: D.valueType.STRING },
        { label: "Size", unit: "GB", valueType: D.valueType.NUMBER },
        { label: "Usage", unit: "%", valueType: D.valueType.NUMBER },
        { label: "Used Size", unit: "GB", valueType: D.valueType.NUMBER },
        { label: "Free Size", unit: "B", valueType: D.valueType.NUMBER },
        { label: "Manufacturer", valueType: D.valueType.STRING },
        { label: "Model", valueType: D.valueType.STRING },
        { label: "Bus Protocol", valueType: D.valueType.STRING }
    ]
);

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
 * @label Get Physical Disk Info
 * @documentation Retrieves operational status of physical disks on a Dell server with iDRAC.
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
    console.log(output)
    var lines = output.split("\n");
    var data = {};
    var instanceIdDisk = false;
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("[InstanceID: Disk.") >= 0) {
            instanceIdDisk = true;
            data = {};
        } else if (instanceIdDisk && line.length === 0) {
            var recordId = (data["InstanceID"]).replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
            var type = data["Device Type"] || "-";
            var description = data["DeviceDescription"] || "-";
            var primaryStatus = data["PrimaryStatus"] || "-";
            var raidStatus = data["RaidStatus"] || "-";
            var raidTypes = data["RAIDTypes"] || "-";
            var size = (data["SizeInBytes"] || "").replace(/\D+/g, "");
            size = (size / 1073741824) || "-";
            var usedSize = (data["UsedSizeInBytes"] || "").replace(/\D+/g, "") ;
            usedSize = (usedSize / 1073741824) || "-"
            var freeSize = (data["FreeSizeInBytes"] || "").replace(/\D+/g, "") || "-";
            var manufacturer = data["Manufacturer"] || "-";
            var model = data["Model"] || "-";
            var busProtocol = data["BusProtocol"] || "-";
            var usage = "-";
            if (usedSize !== "-" && size !== "-") {
                var usedSizeBytes = parseFloat(usedSize);
                var totalSizeBytes = parseFloat(size);
                usage = ((usedSizeBytes / totalSizeBytes) * 100).toFixed(2);
            }
            table.insertRecord(
                recordId, [
                    type,
                    description,
                    primaryStatus,
                    raidStatus,
                    raidTypes,
                    size,
                    usage,
                    usedSize,
                    freeSize,
                    manufacturer,
                    model,
                    busProtocol
                ]
            );
            data = {};
            instanceIdDisk = false;
        } else if (instanceIdDisk) {
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