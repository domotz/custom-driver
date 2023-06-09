/** 
 * Name: Linux Updates Monitoring
 * Description: Monitors the status of the Updates of a Linux machine
 *   
 * Communication protocol is SSH, using the Linux bash command.
 * 
 * Tested on Linux with the following specs:
 *      - Debian Linux 10
 *      - Ubuntu 18.04.5 LTS
 *      - bash version 5.0.3(1)
 * 
 * Requires:
 *      - requires apt
 *      - requires sed, grep, and awk
 *      - PLEASE NOTE: it requires to be run as a user part of the sudoers group without password prompt
 * 
 * Creates a Custom Driver Variable with the Number of Updates available
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Package Name
 *  - Current Version
 *  - New Version 
 * 
**/

var cmdSudoCheck = "echo '" + D.device.password() + "'|sudo -S -v"
var cmdNumberUpdates = "echo '" + D.device.password() + "'|sudo -S apt update -qq 2>/dev/null"
var cmdListOfUpdates = "echo '" + D.device.password() + "'|sudo -S apt list --upgradable -qq 2>/dev/null"
var fullCommand = 
                // break on sudo error
                "set -e;" + 
                cmdSudoCheck + ";"+
                // if sudo is ok run the command
                "set +e;" + 
                cmdNumberUpdates + " | grep -v packages ;" + 
                cmdListOfUpdates + " | grep -v 'Listing' | sed 's\/\\\/\/ \/g' | sed 's\/\\[\/ \/g' | sed 's\/\\]\/ \/g' | awk -F ' ' '{print $1,$7,$3}'";

// SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

// SSH promise definition
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5 || err.code == 1) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

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


/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(fullCommand)
        .then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

var updateListTable = D.createTable(
    "Updates List",
    [
        { label: "Package Name" },
        { label: "Current Version" },
        { label: "New Version" }
    ]
);

function parseData(executionResult) {
    var listOfUpdates = executionResult.split(/\r?\n/);
    for (var i = 0; i < listOfUpdates.length; i++) {
        var fields = listOfUpdates[i].replace(/\s+/g, ' ').trim().split(" ");
        var pkgName = fields[0];
        var pkgOldV = fields[1];
        var pkgNewV = fields[2];
        var recordId = D.crypto.hash(pkgName, "sha256", null, "hex").slice(0, 50);
        updateListTable.insertRecord(
            recordId, [pkgName, pkgOldV, pkgNewV]
        );
    }
    var numberOfAvailableUpdatesLabel = "Number of Updates Available";
    var numberOfAvailableUpdatesValue = listOfUpdates.length;
    numberOfAvailableUpdates = [D.createVariable("available-updates-number", numberOfAvailableUpdatesLabel, numberOfAvailableUpdatesValue, null, D.valueType.NUMBER)];
    D.success(numberOfAvailableUpdates, updateListTable);
}

/**
* @remote_procedure
* @label Get Linux Updates
* @documentation Process data and deliver Linux Updates variables and table
*/
function get_status() {
    executeCommand(fullCommand)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
                
     
}