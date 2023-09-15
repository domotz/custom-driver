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
 *      - requires grep
 *      - PLEASE NOTE: it requires to be run as a user part of the sudoers group without password prompt
 * 
 * Creates a Custom Driver Variable with the Number of Updates available
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Current Version
 *  - New Version 
 * 
**/

var packageFilters = D.getParameter('packageFilters');
var cmdListUpdates = "apt-get -q -y --ignore-hold --allow-change-held-packages --allow-unauthenticated -s dist-upgrade | /bin/grep ^Inst";

if (packageFilters.length > 0) {
    var packages = packageFilters.join("\\|");
    cmdListUpdates += " | grep -E " + packages;
}

// SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

var updateListTable = D.createTable(
    "Updates List",
    [
        { label: "Current Version" },
        { label: "New Version" },
    ]
);

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
    executeCommand(cmdListUpdates)
        .then(parseValidateOutput)
        .then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

function parseValidateOutput(output) {
    if (output.trim() !== "") {
        console.log("Validation successful");
    } else {
        console.log("Validation failed: Unexpected output");
    }
}

function parseData(executionResult) {
    var listOfUpdates = executionResult.split(/\r?\n/);
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    for (var i = 0; i < listOfUpdates.length; i++) {
        var fields = listOfUpdates[i].replace(/[\[\]()]/g, "").split(" ");
        var pkgName = fields[1];
        var pkgOldV = fields[2];
        var pkgNewV = fields[3]; 
        var recordId = pkgName.replace(recordIdSanitizationRegex, '').slice(0, 50);
        updateListTable.insertRecord(
            recordId, [pkgOldV, pkgNewV]
        );
    }
    var variables = [];

    for (var j = 0; j < packageFilters.length; j++) {
        var packageName = packageFilters[j];
        var count = listOfUpdates.filter(function (update) {
            return update.indexOf("Inst " + packageName) !== -1;
        }).length;  
        variables.push(D.createVariable(packageName, packageName, count, null, D.valueType.NUMBER));    
    }
    D.success(variables,updateListTable); 
}

/**
* @remote_procedure
* @label Get Linux Updates
* @documentation Process data and deliver Linux Updates variables and table
*/
function get_status() {
    executeCommand(cmdListUpdates)
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}