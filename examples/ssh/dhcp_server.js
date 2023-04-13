/**
 * This driver monitor dhcp server to retrieve information about IPV4 scopes, DHCP leases, Dhcp options and servers. 
 * The communication protocol is SSH
 */

// Define SSH configuration
var sshConfig = {
    port: 22,
    timeout: 5000,
    username: D.device.username(),
    password: D.device.password()
};
//Array containing two SSH commands. 
//The first command retrieves IPV4 scopes, and the second command retrieves DHCP leases.
//var commands = ["cat /tmp/dhcp.leases", "ip -4 route"];
var commands = ["ip -4 route", "cat /tmp/dhcp.leases"];

// Check for Errors on the SSH command response
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Function for executing SSH command 
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
* @documentation This procedure is used to validate if the driver can be applied on a device.
*/
function validate() {
    getIPV4Scopes(function () {
        getLeases();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure retrieves IPV4 scopes and DHCP leases, create variables for each scope and lease.
*/
function get_status() {
    getIPV4Scopes(function () {
        getLeases();
    });
}

// Retrieves IPV4 scopes by executing the first command from the commands array and creates variables for each scope.
function getIPV4Scopes(callback) {
    exec_command(commands[0], function (res) {
        var variables = [];
        for (var i = 0; i < res.length; i++) {
            var parts = res[i].split(",");
            var uid = "ipv4" + i;
            var label = "ipv4 Scope " + i;
            var value = parts[0];
            var variable = D.device.createVariable(
                uid,
                label,
                value,
                null
            );
            variables.push(variable);
        }
        D.success(variables);
        if (callback) callback();
    });
}

//Retrieves DHCP leases by executing the second command from the commands array and creates variables for each lease.
function getLeases() {
    exec_command(commands[1], function (data) {
        var resultat = [];
        for (var i = 0; i < data.length; i++) {
            var part = data[i].split(",");
            var uid = "lease" + i;
            var label = "Lease " + i;
            var value = part[0];
            var res = D.device.createVariable(
                uid,
                label,
                value,
                null
            );
            resultat.push(res);
        }
        D.success(resultat);
    });

}