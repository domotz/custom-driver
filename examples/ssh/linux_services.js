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

// Define the services you want to show (all|exclude)
var servicesToGet="all"; 

// if using the "exclude" option you might edit the excludeServices variable which contains the list
// remember to follow this format "'systemd\\|apt'" so each pattern should be followed by \\| as a separator
// if your and to exclude only one service you should use "'systemd'"
// PLEASE NOTE THAT the following will not be used if servicesToGet="all"
var excludeServices="'apt\\|ifup\\|key\\|lvm\\|man\\|networking\\|nfs-config\\|vga\\|emergen'"

if (servicesToGet == "exclude") {
    var command ="systemctl --all --type=service | sed -e 's/.service//' | tail -n +2 | awk '{print $1,$4}' | head -n -6 | grep -v 'inactive\\|systemd-fsck' | grep -v "+excludeServices
}
else if (servicesToGet == "all") {
    // we exclude by default ● inactive services and systemd-fsck* services for parsing reasons
    var command ="systemctl --all --type=service | sed -e 's/.service//' | tail -n +2 | awk '{print $1,$4}' | head -n -6 |  grep -v 'inactive\\|systemd-fsck'"        
}
else if (!servicesToGet || /^\s*$/.test(servicesToGet)){
  var error="servicesToGet variable cannot be null or empty - possible options are: all|exclude" ;
  console.error(error);
  D.failure(D.errorType.GENERIC_ERROR);
}
else{
  var error="servicesToGet variable cannot be set as: "+ servicesToGet + " - possible options are: all|exclude";
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
        if(err) checkSshError(err);
        d.resolve(out);
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
    executeCommand(command).then(function(){
        D.success();
    });
}
 
/**
* @remote_procedure
* @label Get Linux Services
* @documentation Process data and deliver Linux Services table
*/
function get_status() {
    executeCommand(command).then(function(result){
        var table = D.createTable(
            "Services List",
            [
                { label: "Service Name" },
                { label: "Status" }
            ]
        );        
        var result = result.split(/\r?\n/);
        for (var i = 0; i < result.length; i++) {
            var fields = result[i].replace(/\s+/g,' ').trim().split(" ");
            console.log(fields)
            var serviceName=fields[0];
            var serviceStatus=fields[1];
            table.insertRecord(
                i+"-"+serviceName.toLowerCase(), [serviceName, serviceStatus]
            );
        }
        D.success(table);
    });
}
