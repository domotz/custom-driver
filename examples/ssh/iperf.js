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
    timeout: 20000
};

var downloadSpeed, uploadSpeed, downloadSpeedUDP, uploadSpeedUDP;

// Define whether UDP is enabled on the device 
var testUDPSpeed = true;

// Define the commands to be executed via SSH to retrieve speed data and variable configuration
var execConfig = [
    { id: "download_speed", label: "Download speed", command: "iperf3 -f m -c localhost -R | grep sender | awk -F \" \" '{print $7}'" },
    { id: "upload_speed", label: "Upload speed", command: "iperf3 -f m -c localhost | grep sender | awk -F \" \" '{print $7}'" },
    { id: "download_speed_udp", label: "Download speed UDP", command: "iperf3 -f m -c localhost -u -R | tail -n 4 | head -n 1 | awk -F \" \" '{print $7}'" },
    { id: "upload_speed_udp", label: "Upload speed UDP", command: "iperf3 -f m -c localhost -u | tail -n 4 | head -n 1 | awk -F \" \" '{print $7}'" }
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
    return function(result){
        var d = D.q.defer();
        sshConfig.command = command;
        D.device.sendSSHCommand(sshConfig, function (out, err) {
            if (err) {
                checkSshError(err);
                d.reject(err);
            }
            if(Array.isArray(result))
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
        .then(function(result){
            return result.map(function(res, index){
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
    execute()
        .then(D.success)
        .catch(failure);
}