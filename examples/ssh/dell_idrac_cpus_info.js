/**
 * Name: Dell iDRAC CPUs Monitoring
 * Description: Monitors the operational status of CPUs on a Dell server with iDRAC
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
 *      - Model
 *      - Primary Status
 *      - CPU Status
 *      - Max Clock Speed
 *      - Current Clock Speed
 *      - Virtualization Technology Enabled
 *      - Hyper Threading Enabled
 * 
 */

// SSH command to retrieve cpus information
var command = "racadm hwinventory";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000,
    "keyboard_interactive": true
};

// Custom Driver Table to store cpus information
var table = D.createTable(
    "CPU Info",
    [
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Description", valueType: D.valueType.STRING },
        { label: "Model", valueType: D.valueType.STRING },
        { label: "Primary Status", valueType: D.valueType.STRING },
        { label: "CPU Status", valueType: D.valueType.STRING },
        { label: "Max Clock Speed", unit: "MHZ", valueType: D.valueType.NUMBER },      
        { label: "Current Clock Speed", unit: "MHZ", valueType: D.valueType.NUMBER }, 
        { label: "Virt Tech Enabled", valueType: D.valueType.STRING },
        { label: "Hyper Threading Enabled", valueType: D.valueType.STRING }
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
 * @label Get CPUs Info
 * @documentation Retrieves operational status of CPUs on a Dell server with iDRAC.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

// Parse cpu information output
function parseData(output) {
    var lines = output.split("\n");
    var data = {};
    var instanceIdCpu = false; 
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line.indexOf("[InstanceID: CPU.Socket") >= 0) {
            instanceIdCpu = true;
            data = {}; 
        } else if (instanceIdCpu && line.length === 0) {
            var recordId = (data["InstanceID"]).replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();;
            var type = data["Device Type"] || "-"; 
            var description = data["DeviceDescription"] || "-"; 
            var model = data["Model"] || "-"; 
            var primaryStatus = data["PrimaryStatus"] || "-"; 
            var cpuStatus = data["CPUStatus"] || "-"; 
            var maxClockSpeed = (data["MaxClockSpeed"] || "").replace(/\D+/g, "") || "-";
            var currentClockSpeed = (data["CurrentClockSpeed"] || "").replace(/\D+/g, "") || "-";
            var virtualizationTechnologyEnabled = data["VirtualizationTechnologyEnabled"] || "-"; 
            var hyperThreadingEnabled = data["HyperThreadingEnabled"] || "-";           
            table.insertRecord(
                recordId, [
                    type,
                    description,
                    model,
                    primaryStatus,
                    cpuStatus,
                    maxClockSpeed,
                    currentClockSpeed,
                    virtualizationTechnologyEnabled,
                    hyperThreadingEnabled
                ]
            );
            data = {};
            instanceIdCpu = false;
        } else if (instanceIdCpu) {
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