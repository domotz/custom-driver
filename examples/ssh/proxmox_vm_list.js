/** 
 * Name: Proxmox VE VMs List
 * Description: Diplays a list of all the VMs and their properties in a Proxmox server.
 *   
 * Communication protocol is SSH.
 * 
 * Tested under Proxmox version 8.0.3
 * 
 * Creates a Custom Driver Table with the following columns:
 *      - VMID : Virtual Machine ID
 *      - Name : Virtual Machine Name
 *      - Status : Virtual Machine Status
 *      - Memory : Memory usage in MB
 *      - Boot Disk Size: Boot disk usage in GB
 *      - Processors : Number of processors
 *      - PID : Process ID
 *      - Net0 MAC : MAC address of the network interface
 *      - Net0 bridge : Network bridge configuration 
 *      - ostype : Operating system type
 *      - Error(s) : Errors in getting info on that specific VM
 * 
 **/

var cmdKVMsList = "qm list";
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 60000
};
 
var kvmsTable = D.createTable(
    "Virtual Machines List",
    [
        { label: "Name", valueType: D.valueType.STRING },
        { label: "Status", valueType: D.valueType.STRING },
        { label: "Memory", unit: "MB", valueType: D.valueType.NUMBER },
        { label: "Boot Disk Size", unit: "GB", valueType: D.valueType.NUMBER },
        { label: "PID", valueType: D.valueType.NUMBER },
        { label: "Processors", valueType: D.valueType.STRING },
        { label: "Net0 MAC", valueType: D.valueType.STRING }, 
        { label: "Net0 bridge", valueType: D.valueType.STRING }, 
        { label: "Numa", valueType: D.valueType.NUMBER },
        { label: "Ostype", valueType: D.valueType.STRING },
        { label: "Error(s)", valueType: D.valueType.STRING }
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
 * @param {string} command The SSH command to execute
 * Return a promise that resolves with the command output or rejects with an error
 */
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            console.error(err);
            d.resolve({err: err.message});
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}
 
/**
 * Parses the output of the SSH command and populates the KVMs table
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
        var promise = executeCommand("qm config " + vmid)
            .then(function(configData) {
                var config = {};
                if (configData.err) {
                    config.error = configData.err;
                } else {
                    var configLines = configData.trim().split('\n');
                    configLines.forEach(function(configLine) {
                        var configValues = configLine.trim().split(": ");
                        var key = configValues[0].trim();
                        var value = configValues[1].trim();
                        config[key] = value;
                    });
                }
                var totalProcessors = config.cores * config.sockets; 
                var processors;
                if (config.cores !== undefined && config.sockets !== undefined) {
                    processors = totalProcessors + " (" + (config.sockets || "-") + " sockets, " + (config.cores || "-") + " cores)";
                } else {
                    processors = "-";
                }
                var net0Config = config.net0 ? config.net0.split(',') : null;
                var net0MAC = "";
                var net0Bridge = "";
                if (net0Config) {
                    for (var i = 0; i < net0Config.length; i++) {
                        var keyValue = net0Config[i].split('=');
                        var key = keyValue[0].trim();
                        var value = keyValue[1].trim();
                        if (key === "virtio") {
                            net0MAC = value;
                        } else if (key === "bridge") {
                            net0Bridge = value;
                        }
                    }
                }
                kvmsTable.insertRecord(recordId, [
                    name,
                    status,
                    memory,
                    bootdisk,
                    pid,
                    processors,
                    net0MAC || "-",
                    net0Bridge || "-",
                    config.numa || "-",
                    config.ostype || "-",
                    config.error ? config.error.code + " : " + config.error.message : "-"
                ]);
            });
        promises.push(promise);
    });
    D.q.all(promises)
        .then(function() {
            D.success(kvmsTable);
        });
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the SSH command is executed successfully
 */
function validate() {
    executeCommand(cmdKVMsList)
        .then(parseValidateOutput)
        .then(D.success)
        .catch(checkSshError);
}

function parseValidateOutput(output) {
    if (!output.err) {
        console.info("Validation successful");
    } else {
        console.error("Validation failed");
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used to retrieve the status of Virtual Machines from the Proxmox server
 */
function get_status() {
    executeCommand(cmdKVMsList)
        .then(parseData)
        .catch(checkSshError);
}