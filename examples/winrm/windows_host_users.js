/**
 * Domotz Custom Driver
 * Name: Windows Host Users Monitoring
 * Description: Monitors the status of all the existing users on a Windows machine
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
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
 *
 * Creates a Custom Driver Table with the following columns:
 *  - Name
 *  - Status
 *  - Description
 *
 **/

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// Define the WinRM options when running the commands
const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

const hostUsersTable = D.createTable(
    "Host Users",
    [
        {label: "Name"},
        {label: "Status"},
        {label: "Description"}
    ]
);
const userDetailsRegexp = /([\w\d]+)\s+([\w]+)\s+(.*)/;

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */

function parseValidateOutput(isValidated) {
    if (isValidated) {
        console.info("Validation successful");
        D.success();
    } else {
        console.error("Validation unsuccessful");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

function validate() {
    const command = "Test-WSMan";
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Host Device Users
 * @documentation This procedure retrieves the users on the host device and outputs if they are enabled or not
 */
function get_status() {
    instance.executeCommand("Get-LocalUser")
        .then(instance.parseOutputToArray)
        .then(parseOutput)
        .catch(instance.checkError);
}


function parseOutput(outputLines) {
    if (outputLines.length >= 2 ){
        for (let i = 2; i < outputLines.length; i++) {
            const line = outputLines[i];
            if (line !== "") {
                const match = line.match(userDetailsRegexp);
                if (match) {
                    const name = match[1];
                    const recordId = name.toLowerCase().substring(0, 50);
                    const status = match[2];
                    const description = match[3];
                    hostUsersTable.insertRecord(recordId, [name, status, description]);
                }
            }
        }
    }
    D.success(hostUsersTable);
}

// WinRM functions
function WinRMHandler() {}

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