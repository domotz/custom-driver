/**
 * This Configuration Management Script Extracts the device configuration for Ubiquiti EdgeOS Devices (such as routers).
 * Communication protocol is SSH.
 * Creates a configuration backup.
 *
 * Required permissions: Level 2 user
 *
 */

/**
* @remote_procedure
* @label Validate Association for Backup
* @documentation This procedure is used to validate if the device supports the needed commands for configuration backup
*/
function validate() {
    console.info("Verifying ... ");
    var validateCommand = "show configuration ?";
    function validateCallback(output, error){
        if (error){
            checkSshError(error);
        } else if (output && output.length === 2 && output[1].indexOf("show configuration all commands") != undefined) {
            D.success();
        } else {
            console.error("Unparsable output " + output)
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        }
    };
    executeCommand(validateCommand)
        .then(validateCallback)
        .catch(checkSshError);
};

/**
* @remote_procedure
* @label Backup Device Configuration
* @documentation Backup the Edge OS device configuration
*/
function backup() {
    var performBackupCommand = "terminal length 0 && show configuration";
    function performBackupCallback(output, error){
        if (error){
            checkSshError(error);
        } else if (output != null) {
            var lines = output[1].split('\n');
            // Remove the first and last lines
            lines.shift(); // Removes the first line
            lines.pop();   // Removes the last line
            // Join the remaining lines back into a single string
            var deviceConfiguration = lines.join('\n');
            D.success(
                D.createBackup(
                    {
                        label: "Device Configuration",
                        running: deviceConfiguration
                    }
                )
            );
        } else {
            console.error("Unparsable output" + output)
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        }
    };
    executeCommand(performBackupCommand)
        .then(performBackupCallback)
        .catch(checkSshError);
}

var sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    inter_command_timeout_ms: 1000,
    global_timeout_ms: 5000,
    prompt: "$",
};
// Utility function that checks the type of error that has occured
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255 || err.code == 1) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}
// Utility function that changes the bash terminal and executes the command on the EdgeOS device
function executeCommand(command) {
    var d = D.q.defer();
    sshOptions.commands = ["exec /bin/vbash", command];
    D.device.sendSSHCommands(sshOptions, function (out, err) {
        if (err) {
            checkSshError(err);
            d.reject(err);
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}