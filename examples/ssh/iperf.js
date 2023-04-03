/**
 * this driver is designed to retrieve network speed data using the iperf3.
 * Communication protocol is SSH.
 * This driver create a dynamic monitoring variables 
 * down: test for download speed.
 * up: test for upload speed.
 * UDPdown: test for UDP download speed.
 * UDPup: test for UDP upload speed. 
 */

// Define SSH configuration
var sshConfig = {
    port: 22,
    timeout: 20000
};

var _var = D.device.createVariable;
var dload, uload, udpdload, udpuload;  // Define variables for storing download/upload speeds

var UDP = "Y"; // Define whether UDP is enabled on the device (set to "Y" by default)

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
function exec_command(command, callback) {
    var config = JSON.parse(JSON.stringify(sshConfig));
    config.command = command;
    D.device.sendSSHCommand(config, function (out, err) {
        if (err) checkSshError(err);
        callback(out.split("\n"));
    });
}

//This function execute the SSH commands to retrieve network speed data using the iperf3 tool, and then creating dynamic monitoring variables based on the obtained data.
function execute() {
    exec_command(commands[0], function (cmd) {
        dload = cmd || 0;
        exec_command(commands[1], function (cmd) {
            uload = cmd || 0;
            if (UDP == "Y") {
                exec_command(commands[2], function (cmd) {
                    udpdload = cmd || 0;
                    exec_command(commands[3], function (cmd) {
                        udpuload = cmd || 0;
                        D.success([
                            _var("down", "DLOAD", dload, "Mb/s"),
                            _var("up", "ULOAD", uload, "Mb/s"),
                            _var("UDPdown", "UDPDLOAD", udpdload, "Mb/s"),
                            _var("UDPup", "UDPULOAD", udpuload, "Mb/s")
                        ]);
                    });
                });
            } else {
                D.success([
                    _var("down", "DLOAD", dload, "Mb/s"),
                    _var("up", "ULOAD", uload, "Mb/s")
                ]);
            }
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
* @documentation This procedure is used to verify if the call of docker command over ssh is successfully done
*/
function validate() {
    execute(function () {
        D.success()
            .catch(failure);
    });
}

/**
* @remote_procedure
* @label Get Docker info
* @documentation This procedure is used to call docker service over ssh and extract the result and create variables to monitor
*/
function get_status() {
    execute(function () {
        D.success()
            .catch(failure);
    });
}