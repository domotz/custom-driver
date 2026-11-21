/**
 * Name: Linux CPU Usage Per Top n process - pidstat
 * Description: This script monitors the average CPU utilization of the top N processes using pidstat
 * 
 * Communication protocol is SSH.
 * 
 * Tested on Linux Distributions:
 *     - Ubuntu 22.04.1 LTS
 * Shell Version:
 *     - Bash 5.1.16
 * 
 * 'pidstat' should be installed on the remote device (using this command "sudo apt install sysstat")
 * 
 * Creates a Custom Driver Variables for CPU Usage(%)
 * 
 */

var commandTimeout = 5000;

var topNoProcesses = D.getParameter("topProcesses"); // Number of top processes to display

var variables = [];

// Define a command to start the 'pidstat' utility in the background.
// The command collects CPU statistics every 2 seconds for a duration of 60.
// The output is redirected to a temporary file at /tmp/domotz_pidstat_cpus.output.
// 2: The interval between updates, in seconds.
// 60: The number of updates or iterations the command will run.
var command = "nohup pidstat -u 2 60 > /tmp/domotz_pidstat_cpus.output";

// Define SSH configuration
var sshConfig = {
    timeout: commandTimeout
};

// Checks for SSH errors and handles them.
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
}

// Executes an SSH command on the remote device.
/**
 * @param {*} command contains the command to execute
 * @param {*} ignoreTimeout ignore ssh timeout error code this is needed to run nohup process without waiting it to finish 
 */
function executeCommand(command, ignoreTimeout) {
    return function () {
        var d = D.q.defer();
        sshConfig.command = command;
        D.device.sendSSHCommand(sshConfig, function (output, error) {
            if (error) {
                if(error.message == "Timeout of " + commandTimeout + "ms expired" && ignoreTimeout){
                    return d.resolve();
                }
                checkSshError(error);
                return d.reject(error);
            }
            d.resolve(output);
        });
        return d.promise;
    };
}

// Checks if 'pidstat' is installed on the remote device based on the provided output.
function checkIfPidstatInstalled() {
    var checkCommand = "which pidstat";
    return executeCommand(checkCommand)()
        .then(function (output) {
            if (output.trim() === "") {
                console.error("pidstat command is not available (it requires the sysstat package installed)");
                D.failure(D.errorType.GENERIC_ERROR);
            } else {
                console.log("pidstat command available");
            }
        })
        .catch(function (err) {
            console.error("Error checking if pidstat is available");
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

// Checks if 'pidstat' is running on the remote device, starts it if necessary, and collects data
function checkPidstatRunning() {
    return checkIfPidstatInstalled()
        .then(executeCommand(command, true))
        .then(function () {
            console.log("pidstat started successfully");
        }).catch(function (err) {
            console.error("Error starting pidstat");
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

// This function attempts to read the content of the file '/tmp/domotz_pidstat_cpus.output'.
// If the file is found, it returns its content. Otherwise, it falls back to collecting historical data
// using 'pidstat' with a 1 second interval for 1 iteration on the specified processes.
function readfile() {
    return executeCommand('cat /tmp/domotz_pidstat_cpus.output | grep "Average:"')()
        .catch(executeCommand("pidstat -u 1 1"));
}

// This function truncates the content of the file '/tmp/domotz_pidstat_cpus.output' to zero bytes.
function truncate(){
    return executeCommand("truncate -s 0 /tmp/domotz_pidstat_cpus.output")()
        .catch(function(){
            console.warn("/tmp/domotz_pidstat_cpus.output doesn't exists");
        });
}

// Parses the output from the 'pidstat' command, extracts CPU usage data, and populates the table with the information.
function parseOutput(output) {
    console.log(output);
    var lines = output.trim().split('\n');
    var processDataStartIndex = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf("Average:") !== -1) {
            processDataStartIndex = i;
            break;
        }
    }

    if (processDataStartIndex !== -1) {
        var header = lines[processDataStartIndex].trim().split(/\s+/);
        var pidIndex = header.indexOf("PID");
        var cpuUsageIndex = header.indexOf("%CPU");
        var commandIndex = header.indexOf("Command");
        var processData = lines.slice(processDataStartIndex + 1);
        processData.sort(function (a, b) {
            var cpuA = parseFloat(a.trim().split(/\s+/)[cpuUsageIndex]);
            var cpuB = parseFloat(b.trim().split(/\s+/)[cpuUsageIndex]);
            return cpuB - cpuA;
        });

        for (var j = 0; j < Math.min(topNoProcesses, processData.length); j++) {
            var line = processData[j].trim().split(/\s+/);
            var pid = line[pidIndex];
            var cpuUsage = line[cpuUsageIndex];
            var processName = line[commandIndex];
            variables.push(D.createVariable(pid, processName, cpuUsage, "%", D.valueType.NUMBER));
        }
        return variables;
    }
}


/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate the script execution by checking if 'pidstat' is installed
 */
function validate() {
    checkIfPidstatInstalled()
        .then(D.success)
        .catch(checkSshError);
}

/**
 * @remote_procedure
 * @label Get CPU usage
 * @documentation Retrieves the CPU usage statistics for the specified processes by reading a temporary file containing pidstat output. 
 * This function performs the following steps:
 * 1. Checks if the pidstat process is running.
 * 2. If pidstat is running, it reads the contents of the file ("/tmp/domotz_pidstat_cpus.output").
 * 3. Retrieve the average CPU usage data for each specified process from the 'pidstat' output.
 * 4. Empties the contents of the file to prepare for the next data collection.
 */
function get_status() {
    readfile()
        .then(parseOutput)
        .then(truncate)
        .then(checkPidstatRunning)
        .then(function(){
            console.log(variables);
            D.success(variables);
        })
        .catch(function () {
            console.error("pidstat is not running");
            D.failure(D.errorType.GENERIC_ERROR);
        });
}