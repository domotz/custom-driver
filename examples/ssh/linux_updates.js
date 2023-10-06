/** 
 * Name: Linux Updates List (apt-based)
 * Description: Display the list of Updates available in a Linux host
 * 
 * Communication protocol is SSH
 * 
 * Tested on Linux: Ubuntu 22.04.3 LTS"
 * 
 * Requires:
 *    - requires apt
 *    - requires grep
 * 
 * Creates a Custom Driver Table with the following columns:
 *      - Current Version
 *      - New Version 
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
        { label: "New Version" }
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
        .catch(checkSshError);
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
    D.success(updateListTable); 
}

/**
* @remote_procedure
* @label Get Linux Updates
* @documentation Process data and deliver Linux Updates table
*/
function get_status() {
    executeCommand(cmdListUpdates)
        .then(parseData)
        .catch(checkSshError);
}