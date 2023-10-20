/** 
 * Name: Proxmox VE General
 * Description: Monitors general and performance properties of a Virtual Machines Proxmox
 *   
 * Communication protocol is SSH.
 * 
 * Tested under Proxmox version 8.0.3
 * 
 * Creates custom driver variables:
 *      - Version : Proxmox server Version
 *      - CPU bogomips : The Bogomips value of the CPU, which is a measurement of CPU speed.
 *      - Regex Operations per Second : The number of regular expression matches per second.
 *      - Hard Disk Size : The size of the hard disk in gigabytes (GB).
 *      - Buffered Disk Reads : The rate of buffered reads from storage, measured in megabytes per second (MB/sec).
 *      - Average Seek Time : The average seek time of the storage device in milliseconds (ms).
 *      - File Syncs per Second : The number of file system sync operations per second.
 *      - DNS Resolution Time : The external DNS (Domain Name System) resolution time in milliseconds (ms).
 **/

var cmdPVEVersion = "pveversion";
var cmdPVEPerf = "pveperf";

var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 60000
};

// Checks and handles SSH errors
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Executes a SSH command and returns a promise
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) {
            d.resolve({error: error.message});
        }else{
            d.resolve(output);
        }
    });
    return d.promise;
}

function execute() {
    return D.q.all([
        executeCommand(cmdPVEVersion),
        executeCommand(cmdPVEPerf)
    ]);
}

function parseValidateOutput(output) {
    for(var i = 0; i<output.length; i++){
        if(!output[i].error){
            console.log("Validation successful");
            return D.success();
        }else{
            console.error("Validation failed");
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
    }
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the SSH command is executed successfully.
 */
function validate() {
    execute()
        .then(parseValidateOutput)
        .catch(checkSshError);
}

// Parses the output of the SSH command 
function parseData(data) {
    var variables = []; 
    var config = {};
    var lines = data[1].split('\n');
    lines.forEach(function (line) {
        var parts = line.split(':');
        if (parts.length === 2) {
            var key = parts[0].trim();
            var value = parseFloat(parts[1].trim());
            config[key] = value;
        }
    });
    variables = [
        D.createVariable("version", "Version", data[0]),
        D.createVariable("cpu_bogomips", "CPU bogomips", config["CPU BOGOMIPS"]),
        D.createVariable("regex_second", "Regex Operations per Second", config["REGEX/SECOND"]),
        D.createVariable("hd_size", "Hard Disk Size", config["HD SIZE"], "GB"),
        D.createVariable("buffered_reads", "Buffered Disk Reads", config["BUFFERED READS"], "MB/sec"),
        D.createVariable("average_seek_time", "Average Seek Time", config["AVERAGE SEEK TIME"], "ms"),
        D.createVariable("filesync_second", "File Syncs per Second", config["FSYNCS/SECOND"]),
        D.createVariable("dns_external", "DNS Resolution Time", config["DNS EXT"], "ms")
    ];
    D.success(variables);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to retrieve general and performance properties from the Proxmox server
 */
function get_status() {
    execute()
        .then(parseData)
        .catch(checkSshError);
}