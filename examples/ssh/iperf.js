/**
 * this driver is designed to retrieve network speed data using the iperf3.
 * Communication protocol is SSH.
 * 
 * This driver create a dynamic monitoring variables 
 *      Download speed: test for download speed.
 *      Upload speed: test for upload speed.
 *      Download speed UDP: test for UDP download speed.
 *      Upload speed UDP: test for UDP upload speed. 
 * 
 * Tested with iperf3 version: v 3.7 under Ubuntu 22.04.1 LTS
 */

// Define SSH configuration
var sshConfig = {
    port: 22,
    timeout: 20000
};

var downloadSpeed, uploadSpeed, downloadSpeedUDP, uploadSpeedUDP;

// Define whether UDP is enabled on the device 
var testUDPSpeed = true;

// Define the commands to be executed via SSH to retrieve speed data
var commands = [
    "iperf3 -f m -c localhost -R | grep sender | awk -F \" \" '{print $7}'",
    "iperf3 -f m -c localhost | grep sender | awk -F \" \" '{print $7}'",
    "iperf3 -f m -c localhost -u -R | tail -n 4 | head -n 1 | awk -F \" \" '{print $7}'",
    "iperf3 -f m -c localhost -u | tail -n 4 | head -n 1 | awk -F \" \" '{print $7}'"
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
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            checkSshError(err);
            d.reject(err);
        }
        d.resolve(out);
    });
    return d.promise;
}

//This function execute the SSH commands to retrieve network speed data using the iperf3 tool.
function execute() {
    return executeCommand(commands[0])
        .then(function (downloadSpeedResult) {
            return executeCommand(commands[1])
                .then(function (uploadSpeedResult) {
                    return [downloadSpeedResult, uploadSpeedResult];
                });
        })
        .then(function (downUpSpeedResults) {
            if (testUDPSpeed) {
                return executeCommand(commands[2])
                    .then(function (downSpeedUdpResult) {
                        return downUpSpeedResults.concat(downSpeedUdpResult);
                    })
                    .then(function (downUpDownUdpSpeedResults) {
                        return executeCommand(commands[3])
                            .then(function (upSpeedUdpResult) {
                                return downUpDownUdpSpeedResults.concat(upSpeedUdpResult);
                            });
                    });
            } else {
                return downUpSpeedResults;
            }
        })
        .catch(failure);
}

//This function is a failure handler for SSH command execution. 
function failure(err) {
    console.log(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This function is used to check if the iperf3 command is available and to validate if the iperf3 commands work correctly.
*/
function validate() {
    // Check if the iperf3 command is available
    executeCommand("which iperf3")
        .then(execute)
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
    execute()
        .then(function (results) {
            downloadSpeed = results[0] || 0;
            uploadSpeed = results[1] || 0;
            downloadSpeedUDP = results[2] || 0;
            uploadSpeedUDP = results[3] || 0;
            D.success([
                D.device.createVariable("download_speed", "Download speed", downloadSpeed, "Mb/s"),
                D.device.createVariable("upload_speed", "Upload speed", uploadSpeed, "Mb/s"),
                D.device.createVariable("download_speed_udp", "Download speed UDP", downloadSpeedUDP, "Mb/s"),
                D.device.createVariable("upload_speed_udp", "Upload speed UDP", uploadSpeedUDP, "Mb/s")
            ]);
        }).catch(failure);
}