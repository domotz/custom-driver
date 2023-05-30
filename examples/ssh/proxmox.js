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
    timeout: 20000
};

var kvmsTable = D.createTable(
    "KVMs",
    [
        { label: "VMID" },
        { label: "Name" },
        { label: "Status" },
        { label: "Memory" , unit: "MB" },
        { label: "Boot disk" , unit: "GB"},
        { label: "PID" },
        { label: "cores" },
        { label: "meta" },
        { label: "net0" },
        { label: "numa" },
        { label: "ostype" },
        { label: "sockets" } 
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
 * @param {string} command  The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function execCommand(command) {
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

/**
 * @description Parses the output of the SSH command and populates the KVMs table
 * @param {string} data The output of the SSH command
 */
function parseData(data) {
    var lines = data.trim().split('\n');
    lines.shift();
    var promises = [];
    lines.forEach(function(line) {
        var values = line.trim().split(/\s+/);
        var vmid = values[0];
        var name = values[1];
        var status = values[2];
        var memory = values[3];
        var bootdisk = values[4];
        var pid = values[5];
        var recordId = vmid + "-" + name;
        var promise = execCommand("qm config " + vmid)
            .then(function(configData) {
                var configLines = configData.trim().split('\n');
                var config = {};
                configLines.forEach(function(configLine) {
                    var configValues = configLine.trim().split(":");
                    var key = configValues[0].trim();
                    var value = configValues[1].trim();
                    config[key] = value;
                });
                kvmsTable.insertRecord(recordId, [vmid, name, status, memory, bootdisk, pid, config.cores, config.meta, config.net0, config.numa, config.ostype, config.sockets]);
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
        .then(D.success)
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