var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000
};
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
* @label Validate Association for Backup
* @documentation This procedure is used to validate if the device supports the needed commands for configuration backup
*/
function validate() {
    console.info("Verifying ... ");
    executeCommand("/sbin/modprobe --help")
        .then(function(output, error){
            if (error){
                checkSshError(error);
            } else if (output && output.includes("Usage: modprobe")) {
                D.success();
            } else {
                // Testts
                console.error("Unparsable output" + output)
                D.failure(D.errorType.RESOURCE_UNAVAILABLE)
            }
        }).catch(checkSshError);
}

/**
* @remote_procedure
* @label Backup Configuration
* @documentation Backup Linux Device configuration
*/
function backup() {
    executeCommand("/sbin/modprobe --showconfig")
        .then(function(output, error){
            if (error){
                checkSshError(error);
            } else if (output != null) {
                backup = D.createBackup(
                    {
                        label: "Device Configuration",
                        running: output
                    }
                );
                D.success(backup);
            } else {
                console.error("Unparsable output" + output)
                D.failure(D.errorType.RESOURCE_UNAVAILABLE)
            }
        }).catch(checkSshError);
}
