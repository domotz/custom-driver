/** 
 * Name: Proxmox monitoring 
 * Description: Monitors status and properties of a Virtual Machines Proxmox.
 *   
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Table with the following columns:
 *      - VMID : Virtual Machine ID
 *      - Name : Virtual Machine Name
 *      - Status : Virtual Machine Status
 *      - Memory : Memory usage in MB
 *      - Boot disk : Boot disk usage in GB
 *      - PID : Process ID
 *      - cores : Number of CPU cores
 *      - meta : Meta information
 *      - net0 : Network interface information
 *      - numa : NUMA (Non-Uniform Memory Access) information
 *      - ostype : Operating system type
 *      - sockets : Number of CPU sockets
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
 **/

var cmdKVMsList = "qm list";
var cmdPVEVersion = "pveversion";
var cmdPVEPerf = "pveperf";
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 120000
};
 
var kvmsTable = D.createTable(
    "KVMs",
    [
        { label: "Name" },
        { label: "Status" },
        { label: "Memory" , unit: "MB" },
        { label: "Boot disk" , unit: "GB" },
        { label: "PID" },
        { label: "cores" },
        { label: "meta" },
        { label: "net0" },
        { label: "numa" },
        { label: "ostype" },
        { label: "sockets" } ,
        { label: "error" } 
    ]
);
 
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
  * @returns {Promise} A promise that resolves with the command output or rejects with an error
  */
function execCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            console.error(err);
            d.resolve({err: err});
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}

function sanitize(str){
    var stringsToReplace = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var regex = new RegExp("("+stringsToReplace.join('|')+")", 'g');
    return str.replace(regex, '').slice(0, 50);
}
 
/**
  * @description Parses the output of the SSH command and populates the KVMs table
  * @param {string} data The output of the SSH command
  */
function parseData(data) {
    var lines = data.trim().split('\n');
    lines.shift();
    var promises = [];
    lines.forEach(function(line) {
        var values = line.match(/(\d+)\s+(.*?)\s+(\w+)\s+(\d+)\s+(\d+\.\d+)\s+(\d+)/);
        var vmid = values[1];
        var name = values[2];
        var status = values[3];
        var memory = values[4];
        var bootdisk = values[5];
        var pid = values[6];
        var recordId = sanitize(vmid);
        var promise = execCommand("qm config " + vmid)
            .then(function(configData) {
                var config = {};
                if (configData.err){
                    config.error = configData.err;
                }else{
                    var configLines = configData.trim().split('\n');
                    configLines.forEach(function(configLine) {
                        var configValues = configLine.trim().split(":");
                        var key = configValues[0].trim();
                        var value = configValues[1].trim();
                        config[key] = value;
                    });
                }
                kvmsTable.insertRecord(recordId, [ 
                    name, 
                    status, 
                    memory,
                    bootdisk, 
                    pid, 
                    config.cores || "-", 
                    config.meta || "-", 
                    config.net0 || "-", 
                    config.numa || "-", 
                    config.ostype || "-", 
                    config.sockets || "-", 
                    config.error ? config.error.code + " : " + config.error.message : ""
                ]);
            });
        promises.push(promise);
    });
    var pveVersionPromise = execCommand(cmdPVEVersion);
    var pvePerfPromise = execCommand(cmdPVEPerf)
        .then(function(perfData) {
            var pvePerf = perfData.trim().split('\n');
            var config = {};
            pvePerf.forEach(function(result) {
                var configValues = result.trim().split(":");
                var key = configValues[0].trim();
                var value = parseFloat(configValues[1].trim());
                config[key] = value;
            });
            return config;
        });
 
    D.q.all([pveVersionPromise, pvePerfPromise])
        .then(function(results) {
            var pveVersionResult = results[0];     
            var pvePerfResult = results[1];
            var result = [
                D.createVariable("version", "Version", pveVersionResult),
                D.createVariable("cpu_bogomips", 'CPU BOGOMIPS', pvePerfResult["CPU BOGOMIPS"]),
                D.createVariable("regex_second", 'REGEX/SECOND', pvePerfResult["REGEX/SECOND"]),
                D.createVariable("hd_size", 'HD SIZE', pvePerfResult["HD SIZE"], "GB"),
                D.createVariable("buffered_reads", 'BUFFERED READS', pvePerfResult["BUFFERED READS"], "MB/sec"),
                D.createVariable("average_seek_time", 'AVERAGE SEEK TIME', pvePerfResult["AVERAGE SEEK TIME"], "ms"),
                D.createVariable("fsync_second", 'FSYNCS/SECOND', pvePerfResult["FSYNCS/SECOND"]),
                D.createVariable("dns_ext", 'DNS EXT', pvePerfResult["DNS EXT"], "ms")
            ];
            D.success(result, kvmsTable);
        });
}
 
/**
  * @remote_procedure
  * @label Validate Association
  * @documentation This procedure is used to validate if the SSH command is executed successfully.
  */
function validate() {
    execCommand(cmdKVMsList)
        .then(function(){
            D.success();
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
 
/**
  * @remote_procedure
  * @label Get Device Variables
  * @documentation This procedure is used to retrieve the status of Virtual Machines from the Proxmox server.
  */
function get_status() {
    execCommand(cmdKVMsList)
        .then(parseData)
        .catch(function(err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
