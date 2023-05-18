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
 * 
 **/

var cmdKVMsList = "qm list";
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
        { label: "PID" }
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
function parseData(data){
    var lines = data.trim().split('\n');
    lines.shift(); 
    lines.forEach(function(line){
        var values = line.trim().split(/\s+/);
        var vmid = values[0];
        var name = values[1];
        var status = values[2];
        var memory = values[3];
        var bootdisk = values[4];
        var pid = values[5];  
        var recordId = vmid + "-" + name;
        kvmsTable.insertRecord(recordId, [vmid, name, status, memory, bootdisk, pid]);
    });
    D.success(kvmsTable); 
} 

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the SSH command is executed successfully.
 */
function validate() {
    execCommand(cmdKVMsList)
        .then(function (){
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
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}