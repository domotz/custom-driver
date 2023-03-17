var sshConfig = {
    port: 22,
    timeout: 30000,
};

var file_size, last_modif;
var _var = D.device.createVariable;

function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function exec_command(command, callback) {
    var config = JSON.parse(JSON.stringify(sshConfig));
    config.command = command;
    D.device.sendSSHCommand(config, function (out, err) {
        if (err) checkSshError(err);
        callback(out.split("\n"));
    });
}


/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the ssh commands are running successfully
*/
function validate() {
    exec_command("stat --printf='File size: %s bytes\nLast modified: %y\n' /home/yosr/zoom_amd64.deb", function () {
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used  
*/
function get_status() {
    exec_command("stat --printf='File size: %s bytes\nLast modified: %y\n' /home/yosr/zoom_amd64.deb", function (result) {
        var file_size = result[0];
        var last_modif = result[1];
        var vars = [
            _var("file_size", "File size", file_size),
            _var("last_modif", "Last modified", last_modif),

        ];
        D.success(vars);

    });
}
