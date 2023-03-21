/**
 * This driver is designed to verify if backup exist and have a certain size.
 * Communication protocol is SSH.
 * This driver create a dynamic monitoring variables 
 * fileSize: to store file size.
 * lastodif: to store last modification date.
 */

// Define SSH configuration object with port and timeout values
var sshConfig = {
    port: 22,
    timeout: 5000
};

var fileSize, lastodif;
var _var = D.device.createVariable;
var path1 = "Add file path"; // Define the path of the file to be accessed through SSH.

//Checking SSH errors and handling them
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Function for executing SSH command. 
function exec_command(command, callback) {
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) checkSshError(err);
        callback(out.split("\n"));
    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the ssh commands are running successfully.
*/
function validate() {
    exec_command("stat --printf='%s\n %y\n' " + path, function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used to retrieve file status and create device variables for file size and last modification date
*/
function get_status() {
    exec_command("stat --printf='%s\n%y\n' " + path, function (result) {
        fileSize = result[0];
        lastModif = result[1];
        var vars = [
            _var("file_size", "File size", fileSize, "bytes"),
            _var("last_modif", "Last modified", lastModif),

        ];
        D.success(vars);
    });
}

