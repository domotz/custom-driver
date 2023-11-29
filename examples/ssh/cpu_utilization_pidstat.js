/**
 * Name: Linux CPU Usage Per process - pidstat
 * Description: This script Retrieves CPU usage for specified processes on a remote Linux device using 'pidstat'
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
 */

var processList = D.getParameter('processList');
var variables = [];

// Define SSH configuration
var sshConfig = {
    timeout: 5000
};

// Checks for SSH errors and handles them
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
}

function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) {
            checkSshError(error);
            d.reject(error);
        }
        d.resolve(output);
    });
    return d.promise;
}

// Checks if 'pidstat' is installed on the remote device based on the provided output.
function checkIfPidstatInstalled() {
    var checkCommand = "which pidstat";
    return executeCommand(checkCommand)
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

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
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

//Parses the output of the 'pidstat' command to extract CPU usage data for each process
function parsePidstatOutput(data) {
    var lines = data.split("\n");
    var header = lines[2].trim().split(/\s+/);
    var pidIndex = header.indexOf("PID");
    var cpuUsageIndex = header.indexOf("%CPU");
    var commandIndex = header.indexOf("Command");
    for (var i = 3; i < lines.length; i++) {
        var line = lines[i].trim().split(/\s+/);
        var pid = line[pidIndex];
        var cpuUsage = line[cpuUsageIndex];
        var command = line[commandIndex];
        var processName = pid + "-" + sanitize(command);     
        var uid = sanitize(processName);
        variables.push(D.createVariable(uid, processName, cpuUsage, "%", D.valueType.NUMBER));
    }
}

/**
 * @remote_procedure
 * @label Get CPU usage per process
 * @documentation This procedure retrieves CPU usage for the specified processes and returns data
 */
function get_status() {
    var command = "pidstat -C " + processList.join("\\|");
    executeCommand(command)
        .then(function (data) {
            parsePidstatOutput(data);
            D.success(variables);
        })
        .catch(checkSshError);
}