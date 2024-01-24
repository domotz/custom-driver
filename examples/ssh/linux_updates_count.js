/** 
 * Name: Linux Updates Count (apt-based)
 * Description: Retrieve the count of available updates on a Linux host
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
 * Creates custom driver variables for the count of available updates for specified packages
 * 
**/

var packagesFilter = D.getParameter("packagesFilter")
var cmdCountUpdates = "apt-get -q -y --ignore-hold --allow-change-held-packages --allow-unauthenticated -s dist-upgrade ";

if (packagesFilter.length > 0) {
    var packages = packagesFilter.join("\\|");
    cmdCountUpdates += "| /bin/grep ^Inst | grep -E " + packages;
} else {
    cmdCountUpdates += "| /bin/grep ^Inst";
}

// SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

// SSH promise definition
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255 || err.code == 1) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
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
* @documentation This procedure is used to validate if the driver can be applied to the device during association and validates credentials
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(cmdCountUpdates)
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
    variables = [];
    for (var j = 0; j < packagesFilter.length; j++) {
        var packageName = packagesFilter[j];
        var count = executionResult.split("\n").filter(function (update) {
            return update.indexOf("Inst " + packageName) !== -1;
        }).length;
        variables.push(D.createVariable(packageName, packageName, count, null, D.valueType.NUMBER));
    }
    D.success(variables);
}

/**
* @remote_procedure
* @label Get Linux Updates Count
* @documentation  Retrieves the count of available updates and creates variables
*/
function get_status() {
    executeCommand(cmdCountUpdates)
        .then(parseData)
        .catch(checkSshError);
}