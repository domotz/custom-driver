/**
 * Domotz Custom Driver 
 * Name: Windows Monitor IP Latency
 * Description: This script is designe to ping an IP address and retrieves the average latency and packet loss percentage.
 *   
 * Communication protocol is SSH
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

// Set up the SSH command options
var sshCommandOptions = {
    "prompt": "]",
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

// A function to check for authentication errors during execution
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command){
    var d = D.q.defer();
    sshCommandOptions.command = command;
    D.device.sendSSHCommand(sshCommandOptions, function (output, error) {
        if(error) checkSshError(error);
        d.resolve(output);
    });
    return d.promise;
}

/**
 * Excuting a simple command to test access to device:
 * 'dir' list the files and directories within a specified directory
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    var commandValidate = "dir";
    console.info("Verifying credentials ... ", commandValidate);
    executeCommand(commandValidate)
        .then(function () {
            D.success();
        })
        .catch(function (error) {
            checkSshError(error);
        });
}

/**
 * @remote_procedure
 * @label Get IP Latency
 * @documentation This procedure retrieves the latency of each IP address by sending ping commands.
 * It populates the Custom Driver table with the IP address, latency, and packet loss.
 */
function get_status() {
    var commandes = ipAddresses.map(function (ipAddress) {
        console.info("Pinging " + ipAddress + " ... ");
        var command = "ping -n " + pktno + " " + ipAddress;
        return executeCommand(command)
            .then(function (output) {
                parseOutput(output, ipAddress);
            })
            .catch(function (error) {
                checkSshError(error);
            });
    });

    D.q.all(commandes)
        .then(function () {
            D.success(tableColumns);
        })
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

function parseOutput(output, ipAddress) {
    var matchLatency = /Average = (\d+)ms/.exec(output);
    var latencyValue = matchLatency[1];
    var matchPacketLoss = /Packets: Sent = \d+, Received = \d+, Lost = (\d+)/.exec(output);
    var packetLossValue = matchPacketLoss[1];
    var recordId = D.crypto.hash(ipAddress, "sha256", null, "hex").slice(0, 50);
    tableColumns.insertRecord(recordId, [ipAddress, latencyValue, packetLossValue]);
}