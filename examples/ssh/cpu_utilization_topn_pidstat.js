/**
 * Name: Linux CPU Usage Per Top n process - pidstat
 * Description: This script monitors the average CPU utilization of the top N processes using pidstat.
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
 * Creates a Custom Driver Table with the following columns:
 *      - Process Name: The name of the process being monitored.
 *      - CPU Usage: The CPU usage percentage for the corresponding process.
 * 
 * Creates a Custom Driver Variables: 
 *      - Start Date: The start date of the data collection period.
 *      - End Date: The end date of the data collection period.
 */

var commandTimeout = 5000;

var timespan_minutes = D.getParameter("timespanMinutes"); // Duration of monitoring in minutes
var process_list = D.getParameter("processList"); // List of processes to monitor
var top_no_processes = D.getParameter("topProcesses"); // Number of top processes to display

var variables = [];
var startDate, endDate; // Variables to store start and end dates

var table = D.createTable(
    "Average CPU Usage",
    [
        { label: "Process Name", valueType: D.valueType.STRING },
        { label: "CPU USage", unit : "%", valueType: D.valueType.NUMBER }    
    ]
);

// Define a command to start the 'pidstat' utility in the background,
// collect CPU statistics every 5 seconds for the specified duration, 
// filter by the specified processes, and output the top processes to a temporary file
var command = "nohup pidstat -u 5 " + timespan_minutes + " -C " + process_list.join("\\|") + " | head -n " + top_no_processes + " > /tmp/domotz_pidstat_cpus.output & echo done";

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
    return executeCommand("cat /tmp/domotz_pidstat_cpus.output")()
        .catch(executeCommand("pidstat -u 1 1 -C " + process_list.join("\\|")));
}

// This function retrieves the start and end dates of a file by executing the 'stat' command.
function getStartEndDates() {
    return executeCommand("stat -c '%w %y' /tmp/domotz_pidstat_cpus.output")()
        .then(function (output) {
            var dates = output.trim().split(" ");
            if(dates[0]== "-"){
                startDate = null;
                endDate = dates[1];
            }
            else {
                startDate = dates[0];
                endDate = dates[3];
            }
            
        })
        .catch(function (err) {
            console.error("Error getting the start and end dates:", err.message);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

// This function truncates the content of the file '/tmp/domotz_pidstat_cpus.output' to zero bytes.
function truncate(){
    return executeCommand("truncate -s 0 /tmp/domotz_pidstat_cpus.output")()
        .catch(function(){
            console.warn("/tmp/domotz_pidstat_cpus.output doesn't exists");
        });
}

// Retrieves the average CPU utilization for each process from 'pidstat' data
function AverageCpuUsage(output) {
    var lines = output.trim().split('\n');
    var averageLineIndex = -1;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('Average:') !== -1) {
            averageLineIndex = i;
            break;
        }
    }

    var averageData = lines.slice(averageLineIndex);
    var header = averageData[0].trim().split(/\s+/);
    var pidIndex = header.indexOf("PID");
    var cpuUsageIndex = header.indexOf("%CPU");
    var commandIndex = header.indexOf("Command");

    for (var j = 1; j < averageData.length; j++) {
        var line = averageData[j].trim().split(/\s+/);
        var pid = line[pidIndex];
        var cpuUsage = line[cpuUsageIndex];
        var command = line[commandIndex];
        table.insertRecord(pid, [command, cpuUsage]);
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
 * 3. Calculates the average CPU usage for each specified process from the pidstat output.
 * 4. Empties the contents of the file to prepare for the next data collection.
 */
function get_status() {
    readfile()
        .then(AverageCpuUsage)
        .then(truncate)
        .then(getStartEndDates)
        .then(checkPidstatRunning)
        .then(getStartEndDates)
        .then(function () {
            if (startDate !== null) {
                var startDateVariable = D.createVariable("start-date", "Start Date", startDate, "", D.valueType.STRING);
                variables.push(startDateVariable);
            }
            var endDateVariable = D.createVariable("end-date", "End Date", endDate, "", D.valueType.STRING);
            variables.push(endDateVariable);

            D.success(variables, table);
        })
        .catch(function () {
            console.error("pidstat is not running");
            D.failure(D.errorType.GENERIC_ERROR);
        });
}