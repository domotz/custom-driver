/**
 * Domotz Custom Driver
 * Name: Windows CPU usage
 * Description: This driver retrieves the average CPU load average percentage of a Windows server.
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates a Custom Driver Variable with CPU load average percentage
 *
 */

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

const command = "Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select Average"

const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

function parseValidateOutput(isValidated) {
    if (isValidated) {
        console.info("Validation successful");
        D.success();
    } else {
        console.error("Validation unsuccessful");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate WinRM connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate() {
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get CPU usage percentage
 * @documentation This procedure retrieves the average CPU load percentage of the device.
 */
function get_status() {
    instance.executeCommand(command)
        .then(instance.parseOutputToArray)
        .then(parseOutput)
        .catch(instance.checkError);
}

/**
 * Parses the output of the WinRM command and extracts the CPU load percentage.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    const cpuValue = output[2].replace(/\s+/g, ""); // To remove all spaces
    const cpuLoadAverage = D.device.createVariable("cpu-load-average", "CPU Load Average", cpuValue, "%", D.valueType.NUMBER);
    D.success([cpuLoadAverage]);
}

// WinRM functions
function WinRMHandler() {
}

// Check for Errors on the command response
WinRMHandler.prototype.checkError = function (output) {
    if (output.message) console.error(output.message);
    if (output.code === 401) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (output.code === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(output);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute command
WinRMHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    config.command = command;
    D.device.sendWinRMCommand(config, function (output) {
        if (output.error) {
            self.checkError(output);
            d.reject(output.error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

WinRMHandler.prototype.parseOutputToArray = function (output) {
    return output.outcome.stdout.trim().split(/\r?\n/);
}

WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout
}

// SSH functions
function SSHHandler() {}

// Check for Errors on the command response
SSHHandler.prototype.checkError = function (output, error) {
    if (error) {
        if (error.message) console.error(error.message);
        if (error.code === 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
        if (error.code === 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

SSHHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    const self = this;
    config.command = 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
    D.device.sendSSHCommand(config, function (output, error) {
        if (error) {
            self.checkError(output, error);
            d.reject(error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

SSHHandler.prototype.parseOutputToArray = function (output) {
    return output.trim().split(/\r?\n/);
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}