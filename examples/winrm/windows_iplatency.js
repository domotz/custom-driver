/**
 * Domotz Custom Driver
 * Name: Windows Monitor IP Latency
 * Description: This script is designed to ping a list of IP addresses specified in the 'ipAddressesToCheck' variable from a Windows host machine and retrieve the average latency and packet loss percentage
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
 *      - Windows 11
 *      - Windows Server 2019
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates a Custom Driver table with a list of ip addresses, their average latency and their packet loss.
 *
 **/
// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

const packetCount = 2; // Number of packets to send during the ping command.
const ipAddressesToCheck = D.getParameter('ipAddressesToCheck');
const config = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

const tableColumns = D.createTable(
    "IP Latency",
    [
        {label: "Latency", unit: "ms"},
        {label: "Packet Loss", unit: "%"}
    ]
);

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
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as to verify the connectivity using the 'ping' command with specific parameters.
 */
function validate() {
    const command = "ping /?";
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

function displayOutput() {
    D.success(tableColumns);
}

/**
 * @remote_procedure
 * @label Get IP Latency
 * @documentation This procedure retrieves the latency of each IP address by sending ping commands.
 * It populates the Custom Driver table with the IP address, latency, and packet loss.
 */
function get_status() {
    const commands = ipAddressesToCheck.map(function (ipAddress) {
        const command = "ping -n " + packetCount + " " + ipAddress;
        return instance.executeCommand(command)
            .then(instance.parseOutputToString)
            .then(function (output) {
                parseOutput(output, ipAddress);
            })
            .catch(instance.checkError);
    });
    D.q.all(commands)
        .then(displayOutput)
}

function parseOutput(output, ipAddress) {
    let latencyValue, packetLossValue;
    const matchLatency = /Average = (\d+)ms/.exec(output);
    latencyValue = matchLatency ? matchLatency[1] : "-";
    const matchPacketLoss = /Packets: Sent = \d+, Received = \d+, Lost = \d+ \((\d+)% loss\)/.exec(output);
    packetLossValue = matchPacketLoss ? matchPacketLoss[1] : "-";
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    const recordId = ipAddress.replace(recordIdSanitizationRegex, '').slice(0, 50);
    tableColumns.insertRecord(recordId, [latencyValue, packetLossValue]);
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
    config.command = 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';

    // config.command = command;
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

WinRMHandler.prototype.parseOutputToString = function (output) {
    return output.outcome.stdout
}

WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout
}

// SSH functions
function SSHHandler() {
}

// Check for Errors on the command response
SSHHandler.prototype.checkError = function (output, error) {
    if (error) {
        if (error.message) console.error(error.message);
        if (error.code === 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
        if (error.code === 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        console.error(error);
        if (error.code !== 1) D.failure(D.errorType.GENERIC_ERROR);
    }
}

SSHHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    const self = this;
    config.command = command;

    // config.command = 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
    D.device.sendSSHCommand(config, function (output, error) {
        if (error) {
            self.checkError(output, error);
            d.resolve(error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

SSHHandler.prototype.parseOutputToString = function (output) {
    return output.output ? output.output : output;
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}