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
 *    - PLEASE NOTE: it requires to be run as a user from the sudoers group with the following settings: $username  ALL =  NOPASSWD : ALL
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Current Version
 *      - New Version
 *
**/

var packagesFilter = D.getParameter("packagesFilter");
var cmdListUpdates = "apt-get -q -y --ignore-hold --allow-change-held-packages --allow-unauthenticated -s dist-upgrade | /bin/grep ^Inst";

if (packagesFilter.length > 0) {
    var packages = packagesFilter.join("\\|");
    cmdListUpdates += " | grep -E " + packages;
}
// grep exits 1 when nothing matches, i.e. on an up-to-date host: that is a success with no updates
cmdListUpdates += "; test $? -le 1";

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
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255 || err.code == 1) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command) {
    sshConfig.command = command;
    return new Promise(function (resolve, reject) {
        D.device.sendSSHCommand(sshConfig, function (out, err) {
            if (err) {
                checkSshError(err);
                reject(err);
            } else {
                resolve(out);
            }
        });
    });
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
    var recordIdReservedWords = ["\\?", "\\*", "\\%", "table", "column", "history"];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join("|"), "g");
    // "Inst <pkg> [<installed>] (<new> <origin> [<arch>])"; a package not installed yet has no [<installed>]
    var instRegex = /^Inst (\S+) (?:\[([^\]]*)\] )?\((\S+)/;
    for (var i = 0; i < listOfUpdates.length; i++) {
        var match = instRegex.exec(listOfUpdates[i].trim());
        if (!match) {
            continue;
        }
        var pkgName = match[1];
        var pkgOldV = match[2] || "N/A";
        var pkgNewV = match[3];
        var recordId = pkgName.replace(recordIdSanitizationRegex, "").slice(0, 50).replace(/\s+/g, "-").toLowerCase(); ;
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
