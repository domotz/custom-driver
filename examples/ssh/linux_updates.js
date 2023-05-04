/** Name: Linux Updates Monitoring
 * Description: Monitors the status of the Updates of a Linux machine
 *   
 * Communication protocol is SSH, using the Linux bash command.
 * 
 * Tested on Linux with the following specs:
 *      - Debian Linux 10
 *      - bash version 5.0.3(1)
 * 
 * Requires:
 *      - requires apt
 *      - requires sed, grep, and awk
 *      - PLEASE NOTE: it requires to be rut as root
 * 
 * Creates a Custom Driver Variable with the Number of Updates available
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Pkg Name
 *  - Old Version
 *  - New Version 
 * 
**/

var cmdNumberOfUpdates = "sudo apt update -qq 2>\/dev\/null | sed 's\/[^0-9 ]*\/\/g' > /tmp/updatesno.txt; cat /tmp/updatesno.txt"
var cmdListOfUpdates="sudo apt update -qq 2>/dev/null | grep -v packages ; sudo apt list --upgradable -qq  2>/dev/null | grep -v 'Listing' | sed 's\/\\\/\/ \/g' | sed 's\/\\[\/ \/g' |  sed 's\/\\]\/ \/g' | awk -F ' ' '{print $1,$7,$3}'"
var result = []
// SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
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
        result.push(out)
        d.resolve();
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
    executeCommand(cmdNumberOfUpdates).then(function(){
        D.success();
    });
}

var updateListTable = D.createTable(
            "Updates List",
            [
                { label: "Pkg Name" },
                { label: "Old version" },
                { label: "New version" }
            ]
        );
 
function parseData(){
    var executionResult = result
    // executionResult is an array
    // cmdListOfUpdates output is executionResult[0]
    // cmdNumberOfUpdates output is executionResult[1]
    
    // parsing cmdListOfUpdates result
    listOfUpdates = executionResult[0];
    var listOfUpdates = listOfUpdates.split(/\r?\n/);
        for (var i = 0; i < listOfUpdates.length; i++) {
            var fields = listOfUpdates[i].replace(/\s+/g,' ').trim().split(" ");
            console.log(fields)
            var pkgName=fields[0];
            var pkgOldV=fields[1];
            var pkgNewV=fields[1];
            console.log(i+"-"+pkgName.toLowerCase()+"-"+pkgName+"-"+pkgOldV+"-"+pkgNewV)

            updateListTable.insertRecord(
                i+"-"+pkgName.toLowerCase(), [pkgName, pkgOldV, pkgNewV]
            );
        }
    
    // parsing cmdNumberOfUpdates result
    var numberOfUpdatesLabel = "Number of Updates Available"
    var numberOfUpdateValue = executionResult[1];

    if (!numberOfUpdateValue || /^\s*$/.test(numberOfUpdateValue)) {
        var error="command output/response is null or empty" ;
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    } 
    else {
        numberOfUpdates = [D.createVariable('updates-number', numberOfUpdatesLabel, numberOfUpdateValue, null, D.valueType.NUMBER)]
        D.success(numberOfUpdates,updateListTable);
    }
   
}
/**
* @remote_procedure
* @label Get Linux Updates
* @documentation Process data and deliver Linux Updates variables and table
*/

function get_status() {
    executeCommand(cmdListOfUpdates)
        .then(function(){
            return executeCommand(cmdNumberOfUpdates)
        }).then(parseData);
}
