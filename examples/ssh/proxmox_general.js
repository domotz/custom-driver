/** 
 * Name: Proxmox VE General
 * Description: Monitors general and performance properties of a Virtual Machines Proxmox.
 *   
 * Communication protocol is SSH.
 * 
 * Tested under Proxmox version 8.0.3
 * 
 * Creates custom driver variables:
 *      - Version : Proxmox serverVersion
 *      - CPU BOGOMIPS : The Bogomips value of the CPU, which is a measurement of CPU speed.
 *      - REGEX/SECOND : The number of regular expression matches per second.
 *      - HD SIZE : The size of the hard disk in gigabytes (GB).
 *      - BUFFERED READS : The rate of buffered reads from storage, measured in megabytes per second (MB/sec).
 *      - AVERAGE SEEK TIME : The average seek time of the storage device in milliseconds (ms).
 *      - FSYNCS/SECOND : The number of file system sync operations per second.
 *      - DNS EXT : The external DNS (Domain Name System) resolution time in milliseconds (ms).
 * 
 **/

var cmdPVEVersion = "pveversion";
var cmdPVEPerf = "pveperf";
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 120000
};
 
//Checks and handles SSH errors
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}
 
/**
  * Executes a SSH command and returns a promise
  * @param {string} command The SSH command to execute
  *  promise that resolves with the command output or rejects with an error
  */
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            checkSshError(err);
            d.reject(err);
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}

function execute(){
    return D.q.all([
        executeCommand(cmdPVEVersion),
        executeCommand(cmdPVEPerf)
    ]);
}

/**
  * @param {string} data The output of the SSH command
  * Parses the output of the SSH command 
  */
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
        variables = [
            D.createVariable("version", "Version", data[0]),
            D.createVariable("cpu_bogomips", 'CPU BOGOMIPS', config["CPU BOGOMIPS"]),
            D.createVariable("regex_second", 'REGEX/SECOND', config["REGEX/SECOND"]),
            D.createVariable("hd_size", 'HD SIZE', config["HD SIZE"], "GB"),
            D.createVariable("buffered_reads", 'BUFFERED READS', config["BUFFERED READS"], "MB/sec"),
            D.createVariable("average_seek_time", 'AVERAGE SEEK TIME', config["AVERAGE SEEK TIME"], "ms"),
            D.createVariable("fsync_second", 'FSYNCS/SECOND', config["FSYNCS/SECOND"]),
            D.createVariable("dns_ext", 'DNS EXT', config["DNS EXT"], "ms")
        ];
    });
    D.success(variables);
}

/**
  * @remote_procedure
  * @label Validate Association
  * @documentation This procedure is used to validate if the SSH command is executed successfully.
  */
function validate() {
    executeCommand(cmdPVEVersion)
        .then(function (data) {
            if (data && data[0] && data[1]) {
                D.success();
            } else {
                console.error("SSH command execution failed.");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(checkSshError);
}
 
/**
  * @remote_procedure
  * @label Get Device Variables
  * @documentation This procedure is used to retrieve general and performance properties from the Proxmox server.
  */
function get_status() {
    execute()
        .then(parseData)
        .catch(checkSshError);
}