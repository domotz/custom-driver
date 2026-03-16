/**
 * This driver is designed to verify if backup exist and have a certain size.
 * Communication protocol is SSH.
 * This driver create a dynamic monitoring variables 
 *      fileSize: to store file size.
 *      lastModif: to store last modification date.
 * 
 * tested under Ubuntu 22.04.1 LTS 
 */

// Define SSH configuration object with port and timeout values
var sshConfig = {
    port: 22,
    timeout: 5000
};

var path = "ADD_FILE_PATH"; // Define the path of the file to be accessed through SSH.

//Checking SSH errors and handling them
function checkSshError(err) {
    if (err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Function for executing SSH command. 
function execCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) checkSshError(err);
        d.resolve(out.split("\n"));
    });
    return d.promise;
}

//This function is a failure handler for SSH command execution. 
function failure(err) {
    console.log(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate SSH Command Execution
* @documentation This procedure is used to validate if the SSH commands can be executed successfully on the remote device.
*/
function validate() {
    execCommand("stat --printf='%s\n%y\n' " + path)
        .then(function () {
            D.success();
        }).catch(failure);
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used to retrieve file status and create device variables for file size and last modification date
*/
function get_status() {
    execCommand("stat --printf='%s\n%y\n' " + path)
        .then(function (result) {
            var fileSize = result[0];
            var lastModif = result[1];
            var vars = [
                D.device.createVariable("file_size", "File size", fileSize, "bytes"),
                D.device.createVariable("last_modif", "Last modified", lastModif),
            ];
            D.success(vars);
        }).catch(failure);
}