/**
 * Domotz Custom Driver 
 * Name: Linux Monitor IP Latency
 * Description: This script its designed to ping a list of IP addresses from a linux host machine and retrieve their average latency and packet loss percentage.
 *   
 * Communication protocol is SSH
 * 
 * Tested on Linux Distributions:
 *      - Ubuntu 20.04 LTS
 * Shell Version:
 *      - Bash 5.1.16
 * 
 * Creates a Custom Driver table with a list of IP addresses, their average latency, and their packet loss.
 * 
 **/

var packetCount = 2; // Number of packets to send during the ping command.
var ipAddresses = ["8.8.8.8"]; // List of IP addresses to ping and retrieve status for.

// Set up the SSH command options
var sshCommandOptions = {
    "timeout": 10000,
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
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command) {
    var d = D.q.defer();
    sshCommandOptions.command = command;
    D.device.sendSSHCommand(sshCommandOptions, function (output, error) {
        if (error) {
            d.resolve(error);
        }else{
            d.resolve(output);
        }
    });
    return d.promise;
}

/**
* @remote_procedure
* @label Host Device Can Measure Latency
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as to verify the connectivity using the 'ping' command with specific parameters.
*/
function validate() {
    var command = "man -P cat ping"; 
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
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    }
}

/**
 * @remote_procedure
 * @label Measure IP Latency For IP Addresses
 * @documentation This procedure retrieves the latency of each IP address by sending ping commands.
 * It populates the Custom Driver table with the IP address, latency, and packet loss.
 */
function get_status() {
    var commands  = ipAddresses.map(function (ipAddress) {
        var command = "ping -c " + packetCount + " " + ipAddress;
        return executeCommand(command, ipAddress)
            .then(function (output) {
                parseOutput(output, ipAddress);
            })
            .catch(function (error) {
                checkSshError(error);
            });
    });     
    D.q.all(commands)
        .then(function () {
            D.success(tableColumns);
        })
        .catch(function (error) {
            checkSshError(error);
        });
}

function parseOutput(output, ipAddress) {
    var latencyValue, packetLossValue;
    var matchLatency = /(\d+\.\d+)\/(\d+\.\d+)\/(\d+\.\d+)\/(\d+\.\d+) ms/.exec(output);
    if (matchLatency && matchLatency.length >= 3) {
        latencyValue = matchLatency[2];
    } else {
        latencyValue = "-1"; 
    }       
    var matchPacketLoss = /(\d+)% packet loss/.exec(output);
    if (matchPacketLoss && matchPacketLoss.length >= 2) {
        packetLossValue = matchPacketLoss[1];
    } else {
        packetLossValue = "100"; 
    }
    var recordId = D.crypto.hash(ipAddress, "sha256", null, "hex").slice(0, 50);
    tableColumns.insertRecord(recordId, [ipAddress, latencyValue, packetLossValue]);
}
