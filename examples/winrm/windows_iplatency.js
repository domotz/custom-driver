/**
 * Domotz Custom Driver 
 * Name: Windows Monitor IP Latency
 * Description: This script is designed to ping a list of IP addresses specified in the 'ipAddressesToCheck' variable from a Windows host machine and retrieve the average latency and packet loss percentage
 * 
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Windows 11
 *      - Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with a list of ip addresses , their average latency and their packet loss.
 * 
 **/

var packetCount = 2; // Number of packets to send during the ping command.
var ipAddressesToCheck  = D.getParameter('ipAddressesToCheck');
var winrmConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000
};

var tableColumns = D.createTable(
    "IP Latency",
    [
        { label: "Latency", unit: "ms" },
        { label: "Packet Loss", unit: "%" }
    ]
);

// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command){
    var d = D.q.defer();
    winrmConfig.command = command;
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            d.resolve(output);
        }else {
            d.resolve({ error: output.error });
        }
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as to verify the connectivity using the 'ping' command with specific parameters.
 */
function validate() {
    executeCommand("ping /?")
        .then(parseValidateOutput)
        .then(D.success)
        .catch(function (error) {
            checkWinRmError(error);
        });
}

function parseValidateOutput(output) {
    if (output.outcome !== undefined && output.outcome.stdout.trim() !== "") {
        console.info("Validation successful");
    } else {
        console.error("Validation unsuccessful. Unexpected output: " + JSON.stringify(output));
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
}

/**
 * @remote_procedure
 * @label Get IP Latency
 * @documentation This procedure retrieves the latency of each IP address by sending ping commands.
 * It populates the Custom Driver table with the IP address, latency, and packet loss.
 */
function get_status() {
    var commands = ipAddressesToCheck.map(function (ipAddress) {
        var command = "ping -n " + packetCount + " " + ipAddress;
        return executeCommand(command)
            .then(function (output) {
                parseOutput(output, ipAddress);
            })
            .catch(function (error) {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            });
    });
    D.q.all(commands)
        .then(function () {
            D.success(tableColumns);
        })
        .catch(function (error) {
            checkWinRmError(error);
        });
}

function parseOutput(output, ipAddress) {
    var latencyValue, packetLossValue;
    if (output.error) {
        latencyValue = "-1";
        packetLossValue = "100";
    } else {
        var outputData = output.outcome.stdout;
        var matchLatency = /Average = (\d+)ms/.exec(outputData);
        latencyValue = matchLatency ? matchLatency[1] : "-";
        var matchPacketLoss = /Packets: Sent = \d+, Received = \d+, Lost = \d+ \((\d+)% loss\)/.exec(outputData);
        packetLossValue = matchPacketLoss ? matchPacketLoss[1] : "-";
    }
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    var recordId = ipAddress.replace(recordIdSanitizationRegex, '').slice(0, 50);
    tableColumns.insertRecord(recordId, [latencyValue, packetLossValue]);
}
