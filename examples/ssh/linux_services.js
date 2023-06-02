/** Name: Linux Services Monitoring
 * Description: Monitors the status of all the services on a Linux machine
 *   
 * Communication protocol is SSH, using the Linux bash command.
 * 
 * Tested on Linux with the following specs:
 *      - Debian Linux 10
 *      - bash version 5.0.3(1)
 * 
 * Requires:
 *      - systemctl
 *      - sed, grep, awk, and tail
 *      - PLEASE NOTE: it requires to be run as a user from the sudoers group
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Service Name
 *  - Service Status
 * 
**/

var includedServices = ["snmpd", "ssh", "zabbix"]; //Define the services you want to include. If empty all services are retrieved
var command = "systemctl --all --type=service | sed -e 's/.service//' | tail -n +2 | awk '{print $1,$4}' | head -n -6 | grep -v 'inactive\\|systemd-fsck'";

// Filter the services based on the includedServices array
if (includedServices.length > 0) {
    var includedServicesString = includedServices.join("\\|");
    command += " | grep -E " + includedServicesString;
} 

// SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 5000
};

var table = D.createTable(
    "Services List",
    [
        { label: "Service Name" },
        { label: "Status" }
    ]
); 
// SSH promise definition
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command){
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            console.error("Command execution error: " + err);
            checkSsherr(err);
            d.reject(err);
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(command)
        .then(function(){
            D.success();
        })
        .catch(checkSshError);
}
 
/**
* @remote_procedure
* @label Get Linux Services
* @documentation Process data and deliver Linux Services table
*/
function get_status() {
    executeCommand(command)
        .then(parseOutput)
        .then(D.success)
        .catch(checkSshError);
}

/**
 * Parses the output of the executed command to extract service information.
 * @param {string} output  The output of the executed command.
 */
function parseOutput(output){     
    var result = output.split(/\r?\n/);
    for (var i = 0; i < result.length; i++) {
        var fields = result[i].replace(/\s+/g," ").trim().split(" ");
        var serviceName = fields[0];
        var serviceStatus = fields[1];
        var recordId = _getRecordIdForService(i, serviceName);
        table.insertRecord(
            recordId, [serviceName, serviceStatus]
        );
    }
    D.success(table);
}

// Helper function to generate record ID for a service
function _getRecordIdForService(index, serviceName) {
    var idString = index + "_" + serviceName;
    var hashedId = D.crypto.hash(idString, "sha256", null, "hex").toLowerCase().slice(0, 50);
    return hashedId;
}