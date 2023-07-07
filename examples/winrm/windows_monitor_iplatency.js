/**
 * Domotz Custom Driver 
 * Name: Windows Monitor IP Latency
 * Description: Tis script is designe pings an IP address and retrieves the average latency and packet loss percentage.
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with a list of ip addresses , their average latency and their packet loss.
 * 
 **/

var pktno = "2"; // Number of packets to send during the ping command.
var ipAddresses = ["8.8.8.8", "1.1.1.1", "192.168.0.1", "192.168.0.2", "192.168.0.3"]; // List of IP addresses to ping and retrieve status for.
var winrmConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

var tableColumns = D.createTable(
    "IP Latency",
    [
        { label: "IP Address" },
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

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    winrmConfig.command = "ping -n " + pktno + " 8.8.8.8";
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            D.success();
        } else {
            checkWinRmError(output.error);
        }
    });
}

/**
 * @remote_procedure
 * @label Get IP Latency
 * @documentation This procedure retrieves the latency of each IP address by sending ping commands.
 * It populates the Custom Driver table with the IP address, latency, and packet loss.
 */
function get_status() {
    var index = 0;
    // Ping the next IP address in the list.
    function pingAddress() {
        if (index >= ipAddresses.length) {
            D.success(tableColumns);
        }

        var currentIp = ipAddresses[index];
        var command = "ping -n " + pktno + " " + currentIp;
        winrmConfig.command = command;
        D.device.sendWinRMCommand(winrmConfig, function (output) {
            parseOutput(output, currentIp);
            index++;
            pingAddress();
        });
    }
    pingAddress();
}

/**
 * Parse the output of the ping command and insert the IP address, latency, and packet loss into the Custom Driver table.
 * @param {object} output  The output object from the WinRM command response.
 * @param {string} ipAddress The IP address being processed.
 */
function parseOutput(output, ipAddress) {
    if (output.error === null) {
        var outputData = output.outcome.stdout;
        var matchLatency = /Average = (\d+)ms/.exec(outputData);
        var latencyValue = matchLatency[1];
        var matchPacketLoss = /Packets: Sent = \d+, Received = \d+, Lost = (\d+)/.exec(outputData);
        var packetLossValue = matchPacketLoss[1];
        var recordId = D.crypto.hash(ipAddress, "sha256", null, "hex").slice(0, 50);
        tableColumns.insertRecord(recordId, [ipAddress, latencyValue, packetLossValue]);
    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}