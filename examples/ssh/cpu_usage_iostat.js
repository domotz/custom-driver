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
 *      - Used(total): Total used CPU usage
 *      - User: The percentage of CPU time spent executing user processes
 *      - Nice: The percentage of CPU time spent on processes with a "nice" priority setting
 *      - System: The percentage of CPU time used by system processes, including the kernel
 *      - Iowait: The percentage of CPU time that the CPU is waiting for input/output operations to complete 
 *      - Steal: The percentage of time the virtual machine process is waiting on the physical CPU for its CPU time
 *      - Free (idle): The percentage of CPU capacity not being used
 *      - Start Date: The start date of the data collection period.
 *      - End Date: The end date of the data collection period.
 */

// Define a command to start the 'iostat' utility in the background,
// collect CPU statistics every 5 seconds for 2 minutes, and redirect its output to a temporary file.
var command = "nohup iostat -c 5 60 > /tmp/domotz_iostat_cpus.output & echo done";
var commandTimeout = 5000;
var startDate, endDate; // Variables to store start and end dates

// Define SSH configuration
var sshConfig = {
    timeout: commandTimeout
};

// this will contains the last result
var variables;

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

// Checks if 'iostat' is installed on the remote device based on the provided output.
function checkIfIostatInstalled() {
    var checkCommand = "which iostat";
    return executeCommand(checkCommand)()
        .then(function (output) {
            if (output.trim() === "") {
                console.error("iostat command is not available (it requires the sysstat package installed)");
                D.failure(D.errorType.GENERIC_ERROR);
            } else {
                console.log("iostat command available");
            }
        })
        .catch(function (err) {
            console.error("Error checking if iostat is available");
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
        .then(executeCommand(command, true))
        .then(function () {
            console.log("iostat started successfully");
        }).catch(function (err) {
            console.error("Error starting iostat");
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

function readfile() {
    return executeCommand("cat /tmp/domotz_iostat_cpus.output")()
        .catch(executeCommand("iostat -c 1 1"));
}

// This function retrieves the start and end dates of a file by executing the 'stat' command.
function getStartEndDates() {
    return executeCommand("stat -c '%w %y' /tmp/domotz_iostat_cpus.output")()
        .then(function (output) {
            var dates = output.trim().split(" ");
            startDate = dates[0];
            endDate = dates[3];
        })
        .catch(function () {
            console.error("Error getting the start and end dates");
            D.failure(D.errorType.GENERIC_ERROR);
        });
}


function truncate(){
    return executeCommand("truncate -s 0 /tmp/domotz_iostat_cpus.output")()
        .catch(function(){
            console.warn("/tmp/domotz_iostat_cpus.output doesn't exists");
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
        if (line.indexOf('avg-cpu:') >= 0) {
            var parts = lines[i+1].split(/\s+/);
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
    var totalUsage = avgUser + avgNice + avgSystem + avgSteal;

    variables = [
        D.createVariable("total-usage", "Used (total)", totalUsage.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("user", "User", avgUser.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("nice", "Nice", avgNice.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("system", "System", avgSystem.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("iowait", "Iowait", avgIowait.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("steal", "Steal", avgSteal.toFixed(2), "%", D.valueType.NUMBER),
        D.createVariable("idle", "Free (idle)", avgIdle.toFixed(2), "%", D.valueType.NUMBER)       
    ];
}

/**
 * @remote_procedure
 * @label Get CPU usage
 * @documentation Retrieves the CPU usage statistics by reading a temporary file containing iostat output. This function performs the following steps:
 * 1. Checks if the iostat process is running.
 * 2. If iostat is running, it reads the contents of the file ("/tmp/domotz_iostat_cpus.output").
 * 3. Calculates the average CPU usage from the iostat output.
 * 4. Empties the contents of the file to prepare for the next data collection.
 */
function get_status() {
    getStartEndDates()
        .then(readfile)
        .then(calculateAverage)
        .then(truncate)
        .then(checkIostatRunning)
        .then(function () {
            var startDateVariable = D.createVariable("start-date", "Start Date", startDate, "", D.valueType.STRING);
            var endDateVariable = D.createVariable("end-date", "End Date", endDate, "", D.valueType.STRING);
            if (startDate === "-") {
                variables.push(endDateVariable);
            } else {
                variables.push(startDateVariable);
                variables.push(endDateVariable);
            }
            D.success(variables);
        })
        .catch(function () {
            console.error("iostat is not running");
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
