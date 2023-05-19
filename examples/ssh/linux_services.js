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
 *      - requires systemctl
 *      - requires sed, grep, awk, and tail
 *      - PLEASE NOTE: it requires to be rut as root
 * 
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Service Name
 *  - Service Status
 * 
**/

// Define the services you want to show (all|include)
var servicesToGet="include"; 

// if using the "include" option you might edit the includeServices variable which contains the list
// remember to follow this format "'systemd\\|apt'" so each pattern should be followed by \\| as a separator
// if your and to include only one service you should use "'systemd'"
// PLEASE NOTE THAT the following will not be used if servicesToGet="all"
var includeServices="'systemd\\|apt'";
var command, error;
if (servicesToGet == "include") {
    command = "systemctl --all --type=service | sed -e 's/.service//' | tail -n +2 | awk '{print $1,$4}' | head -n -6 | grep -v 'inactive\\|systemd-fsck' | grep -v " + includeServices;
}
else if (servicesToGet == "all") {
    // we include by default ● inactive services and systemd-fsck* services for parsing reasons
    command ="systemctl --all --type=service | sed -e 's/.service//' | tail -n +2 | awk '{print $1,$4}' | head -n -6 |  grep -v 'inactive\\|systemd-fsck'";        
}
else if (!servicesToGet || /^\s*$/.test(servicesToGet)){
    error="servicesToGet variable cannot be null or empty - possible options are: all|include" ;
    console.error(error);
    D.failure(D.errorType.GENERIC_ERROR);
}
else{
    error="servicesToGet variable cannot be set as: " + servicesToGet + " - possible options are: all|include";
    console.error(error);
    D.failure(D.errorType.GENERIC_ERROR);
}

// SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
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
            checkSshError(err);
            d.reject(err);
        }
        else{
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
        });
}
 
/**
* @remote_procedure
* @label Get Linux Services
* @documentation Process data and deliver Linux Services table
*/
function get_status() {
    executeCommand(command)
        .then(parseOutput)
        .then(function(){
            D.success();
        })
        .catch(function(error) {
            checkSshError(error);
        });
}

function parseOutput(output){       
    var result = output.split(/\r?\n/);
    for (var i = 0; i < result.length; i++) {
        var fields = result[i].replace(/\s+/g,' ').trim().split(" ");
        var serviceName = fields[0];
        var serviceStatus = fields[1];
        table.insertRecord(
            i + "-" + serviceName.toLowerCase(), [serviceName, serviceStatus]
        );
    }
    D.success(table);
}