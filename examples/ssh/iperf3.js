/**
 * Domotz Custom Driver
 * Name: IPerf3 
 * Description: This driver is designed to retrieve network speed data using iPerf3.
 * 
 * Communication protocol is SSH.
 * 
 * 
 * This driver create a dynamic monitoring variables 
 *      Download speed: test for download speed.
 *      Upload speed: test for upload speed.
 *      Download speed UDP: test for UDP download speed.
 *      Upload speed UDP: test for UDP upload speed. 
 * 
 * Tested on:
 * - Ubuntu 22.04.1 LTS
 * - with iperf3 version: v3.7
 *
 * 
 * The driver is currently using a public iPerf3 server which might stop working in the future.
 * If that is the case, you might try with another server which you might find at this URL: https://iperf.fr/iperf-servers.php 
 * or instead, you might setup you own iPerf3 server. 
 * 
 * You can edit the targetServer object to configure the iPerf3 server to be used. 
 * 
 */

// Define SSH configuration
var sshConfig = {
    timeout: 60000,
    port: 27123
};

var downloadSpeed, uploadSpeed, downloadSpeedUDP, uploadSpeedUDP;

// Define whether UDP is enabled on the device 
var testUDPSpeed = true;

// Define here your target iPerf3 server host and port
var targetServers = [
    { url: "ping-90ms.online.net", port: 5209 },
    { url: "speed.as208196.net", port: 5209 }
];

// Define the commands to be executed via SSH to retrieve speed data and variable configuration
var execConfig = [
    { id: "download_speed", label: "Download speed", command: "iperf3 -f m -c " + targetServers[0].url + " -p " + targetServers[0].port + " -R | grep sender | awk -F \" \" '{print $7}'" },
    { id: "upload_speed", label: "Upload speed", command: "iperf3 -f m -c " + targetServers[0].url + " -p " + targetServers[0].port + " | grep sender | awk -F \" \" '{print $7}'" },
    { id: "download_speed_udp", label: "Download speed UDP", command: "iperf3 -f m -c " + targetServers[0].url + " -p " + targetServers[0].port + " -u -R | tail -n 4 | head -n 1 | awk -F \" \" '{print $7}'" },
    { id: "upload_speed_udp", label: "Upload speed UDP", command: "iperf3 -f m -c " + targetServers[0].url + " -p " + targetServers[0].port + " -u | tail -n 4 | head -n 1 | awk -F \" \" '{print $7}'" }
];

//Checking SSH errors and handling them
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Function for executing SSH command 
function executeCommand(command) {
    return function (result) {
        var d = D.q.defer();
        sshConfig.command = command;
        D.device.sendSSHCommand(sshConfig, function (out, err) {
            if (err) {
                console.error(err);
                d.resolve();
            }
            if (Array.isArray(result))
                result.push(out);
            d.resolve(result);
        });
        return d.promise;
    };
}

//This function execute the SSH commands to retrieve network speed data using the iperf3 tool.
function execute() {
    var commands = [
        executeCommand(execConfig[0].command),
        executeCommand(execConfig[1].command),
    ];
    if (testUDPSpeed) {
        commands.push(executeCommand(execConfig[2].command));
        commands.push(executeCommand(execConfig[3].command));
    }

    return commands.reduce(D.q.when, D.q([]))
        .then(function (result) {
            return result.filter(function(res) {return res != null;}).map(function (res, index) {
                return D.device.createVariable(execConfig[index].id, execConfig[index].label, res, "Mb/s");
            });
        });

}

//This function is a failure handler for SSH command execution. 
function failure(err) {
    console.log(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This function is used to check if the iperf3 command is available.
*/
function validate() {
    // Check if the iperf3 command is available
    executeCommand("which iperf3")()
        .then(function () {
            D.success();
        })
        .catch(failure);
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving iperf3 results
*/
function get_status() {
    var serverIndex = 0;
  
    function tryNextServer() {
        if (serverIndex >= targetServers.length) {
            console.error("All servers are busy or unreachable.");
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
  
        targetServer = targetServers[serverIndex];
  
        execute()
            .then(D.success)
            .catch(function (err) {
                if (err.include("the server is busy running a test")) {
                    serverIndex++;
                    tryNextServer();
                } else {
                    failure(err);
                }
            });
    }
    tryNextServer();
}