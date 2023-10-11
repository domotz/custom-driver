/**
 * Name: Linux CPU Usage - Iostat
 * Description: This script monitor the average CPU usage of a linux server using the iostat package
 * 
 * Communication protocol is SSH.
 * 
 * Tested on Linux Distributions:
 *     - Ubuntu 22.04.1 LTS
 * Shell Version:
 *     - Bash 5.1.16
 * 
 * 'iostat' should be installed on the remote device (using this command "sudo apt install sysstat")
 * 
 * Creates a Custom Driver Variables: 
 *      - User: The percentage of CPU time spent executing user processes
 *      - Nice: The percentage of CPU time spent on processes with a "nice" priority setting
 *      - System: The percentage of CPU time used by system processes, including the kernel
 *      - Iowait: The percentage of CPU time that the CPU is waiting for input/output operations to complete 
 *      - Steal: The percentage of time the virtual machine process is waiting on the physical CPU for its CPU time
 *      - Idle: The percentage of CPU capacity not being used
 */

// Define a command to start the 'iostat' utility in the background,
// collect CPU statistics every 5 seconds for 2 minutes, and redirect its output to a temporary file.
var command = "nohup timeout 120s iostat -c 5 > /tmp/dootz_iostat_cpus.output &";

// Define SSH configuration
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 150000
};

// Checks for SSH errors and handles them.
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Executes an SSH command on the remote device.
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) checkSshError(error);
        d.resolve(output);
    });
    return d.promise;
}

// Checks if 'iostat' is installed on the remote device based on the provided output.
function checkIfIostatInstalled() {
    var checkCommand = "which iostat"; 
    return executeCommand(checkCommand)
        .then(function(output){
            if (output.trim() === "") {
                console.error("iostat is not installed");
                D.failure(D.errorType.GENERIC_ERROR);
            } else {
                console.log("iostat is installed");
            }
        })
        .catch(function (err) {
            console.error("Error checking if iostat is installed");
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate the script execution by checking if 'iostat' is installed
 */
function validate() {
    checkIfIostatInstalled()
        .then(D.success)
        .catch(checkSshError);
}

// Checks if 'iostat' is running on the remote device, starts it if necessary, and collects data
function checkIostatRunning() {
    return checkIfIostatInstalled()
        .then(function () {
            return executeCommand(command)
                .then(function () {
                    console.log("iostat started successfully");
                })
                .catch(function (err) {
                    console.error("Error starting iostat");
                    console.error(err);
                    D.failure(D.errorType.GENERIC_ERROR);
                });
        });
}

// Calculates the average CPU utilization from 'iostat' data
function calculateAverage(data) {
    var lines = data.split('\n');
    var sumUser = 0;
    var sumNice = 0;
    var sumSystem = 0;
    var sumIowait = 0;
    var sumSteal = 0;
    var sumIdle = 0;
    var count = 0;
    for (var i = 2; i < lines.length; i++) {
        var line = lines[i];
        if (line.indexOf('avg-cpu:')) {
            var parts = line.split(/\s+/);
            var user = parseFloat(parts[1]);
            var nice = parseFloat(parts[2]);
            var system = parseFloat(parts[3]);
            var iowait = parseFloat(parts[4]);
            var steal = parseFloat(parts[5]);
            var idle = parseFloat(parts[6]);      
            if (!isNaN(user) && !isNaN(nice) && !isNaN(system) && !isNaN(iowait) && !isNaN(steal) && !isNaN(idle)) {
                sumUser += user;
                sumNice += nice;
                sumSystem += system;
                sumIowait += iowait;
                sumSteal += steal;
                sumIdle += idle;
                count++;
            }       
        }
    }

    var avgUser = sumUser / count;
    var avgNice = sumNice / count;
    var avgSystem = sumSystem / count;
    var avgIowait = sumIowait / count;
    var avgSteal = sumSteal / count;
    var avgIdle = sumIdle / count;
    var variables = [
        D.createVariable("user", "User", avgUser.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("nice", "Nice", avgNice.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("system", "System", avgSystem.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("iowait", "Iowait", avgIowait.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("steal", "Steal", avgSteal.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("idle", "Idle", avgIdle.toFixed(2), "%", D.valueType.NUMBER)
    ];
    D.success(variables);
}


/**
 * @remote_procedure
 * @label Get CPU usage
 * @documentation Retrieves the CPU usage statistics by reading a temporary file containing iostat output. This function performs the following steps:
 * 1. Checks if the iostat process is running.
 * 2. If iostat is running, it reads the contents of the file ("/tmp/dootz_iostat_cpus.output").
 * 3. Calculates the average CPU usage from the iostat output.
 * 4. Empties the contents of the file to prepare for the next data collection.
 */
function get_status() {
    checkIostatRunning()
        .then(function () {
            return executeCommand("cat /tmp/dootz_iostat_cpus.output")
                .then(function (output) {
                    return calculateAverage(output);
                })
                .catch(function (err) {
                    console.error("Error reading iostat output file");
                    console.error(err);
                    D.failure(D.errorType.GENERIC_ERROR);
                })
                .then(function () {
                    return executeCommand("truncate -s 0 /tmp/dootz_iostat_cpus.output");
                });
        })
        .catch(function () {
            console.error("iostat is not running");
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
