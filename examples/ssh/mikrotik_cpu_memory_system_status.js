/**
 * Domotz Custom Driver
 * Name: Mikrotik CPU and Memory Usage, Firmware and Uptime
 * Description: This script retrieves information about MikroTik RouterOS devices, including CPU and memory usage, firmware version, and uptime.
 *
 * Communication protocol is ssh
 *
 * Tested under MikroTik RouterOS with the following versions:
 *      - CCR2004-1G-12S+2XS
 *      - CRS354-48P-4S+2Q+
 *      - CRS326-24G-2S+
 *      - CRS328-24P-4S+
 *
 * Creates a Custom Driver Variable with the retrieved data:
 *      - CPU Usage: Percentage of CPU usage.
 *      - Memory Usage: Percentage of memory usage.
 *      - Uptime: System uptime in days.
 *      - Firmware Version: Firmware version of the MikroTik device.
 *      - CPU Description: Description of the CPU on the MikroTik device.
 *      - CPU Frequency: CPU frequency in megahertz.
 *      - CPU Count: Number of CPUs on the MikroTik device.
 *      - Board Name: Name of the MikroTik device board.
 *      - HD Usage: Percentage of hard disk usage
 *
 */

// SSH command to retrieve system resource information
var command = "system resource print";

// SSH options when running the command
var sshConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 5000
};

//Handle SSH errors
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code == 255) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute SSH command and return a promise
function executeCommand(command) {
    sshConfig.command = command;
    return new Promise(function (resolve) {
        D.device.sendSSHCommand(sshConfig, function (output, error) {
            if (error) {
                resolve(error);
            } else {
                resolve(output);
            }
        });
    });
}

function convertToBytes(value) {
    var units = { KiB: 1, MiB: 2, GiB: 3, TiB: 4 };
    var match = /^([\d.]+)\s*([KMGT]iB)?$/.exec((value || "").trim());
    if (!match) {
        return NaN;
    }
    return parseFloat(match[1]) * (match[2] ? Math.pow(1024, units[match[2]]) : 1);
}

// RouterOS prints the uptime as e.g. "2w3d4h5m6s"; every part is optional
function convertUptimeToSeconds(uptime) {
    var unitSeconds = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
    var total = 0;
    var partRegex = /(\d+)([wdhms])/g;
    var match;
    while ((match = partRegex.exec(uptime)) !== null) {
        total += parseInt(match[1], 10) * unitSeconds[match[2]];
    }
    return total;
}

// Parses the system resource information and creates Custom Driver Variables
function parseData(output) {
    var lines = output.split("\n");
    var data = {};
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line !== "") {
            var parts = line.split(":");
            var key = parts[0].trim();
            var value = parts[1].trim();
            data[key] = value;
        }
    }

    var cpuUsage = data["cpu-load"] ? data["cpu-load"].replace("%", "") : "";
    var totalMemory = convertToBytes(data["total-memory"]) || 0;
    var freeMemory = convertToBytes(data["free-memory"]) || 0;
    var memoryUsage = totalMemory ? ((totalMemory - freeMemory) / totalMemory * 100).toFixed(2) : 0;
    var uptime = data["uptime"] || "";
    var uptimeInSeconds = convertUptimeToSeconds(uptime);
    var uptimeInDays = (uptimeInSeconds / (24 * 3600)).toFixed(1);
    var firmwareVersion = data["version"] || "";
    var cpuDescription = data["cpu"] || "";
    var cpuFrequency = data["cpu-frequency"] ? data["cpu-frequency"].replace("MHz", "") : "";
    var cpuCount = data["cpu-count"] || "";
    var boardName = data["board-name"] || "";
    var freeHddSpace = convertToBytes(data["free-hdd-space"]) || 0;
    var totalHddSpace = convertToBytes(data["total-hdd-space"]) || 0;
    var hddUsage = totalHddSpace ? ((totalHddSpace - freeHddSpace) / totalHddSpace * 100).toFixed(2) : 0;

    var variables = [
        (D.createVariable("cpu-usage", "CPU Usage", cpuUsage, "%", D.valueType.NUMBER)),
        (D.createVariable("memory-usage", "Memory Usage", memoryUsage, "%", D.valueType.NUMBER)),
        (D.createVariable("uptime", "Uptime", uptimeInDays, "days", D.valueType.NUMBER)),
        (D.createVariable("firmware-version", "Firmware Version", firmwareVersion, null, D.valueType.STRING)),
        (D.createVariable("cpu", "CPU Description", cpuDescription, null, D.valueType.STRING)),
        (D.createVariable("cpu-frequency", "CPU Frequency", cpuFrequency, "MHz", D.valueType.NUMBER)),
        (D.createVariable("cpu-count", "CPU Count", cpuCount, null, D.valueType.NUMBER)),
        (D.createVariable("board-name", "Board Name", boardName, null, D.valueType.STRING)),
        (D.createVariable("hd-usage", "HD Usage", hddUsage, "%", D.valueType.NUMBER))
    ];

    var filteredVariables = variables.filter(function (variable) { return variable.value;});
    D.success(filteredVariables);
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
    if (output.trim !== undefined && output.trim() !== "") {
        console.info("Validation successful");
    } else {
        console.error("Validation unsuccessful. Unexpected output: " + JSON.stringify(output));
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
}

/**
 * @remote_procedure
 * @label Get MikroTik System Info
 * @documentation Retrieves system resource information from the MikroTik device.
 */
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
