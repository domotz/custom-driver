

/**
 * This driver extract routing informations for freebsd os
 * Communication protocol is ssh
 * Create a table that contains routes information
 * Tested under freebsd 12.3-STABLE
 */

var validateCmd = "netstat -r -n";
var routeV4Cmd = "netstat -4 -r -n | tail -n +5";
var routeV6Cmd = "netstat -6 -r -n | tail -n +5";

var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

var table = D.createTable("Routing table", [
    { label: "Destination" },
    { label: "Gateway" },
    { label: "Flags" },
    { label: "Netif Expire" },
]);

/**
 * 
 * @param {object} err check ssh different errors
 */
function checkSshError(err){
    console.error(err);
    if(err.message){
        console.error(err.message);
    }
    if(err.code == 5){
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    }else if(err.code == 255){
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
    console.error("error while executing command: " + command);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * 
 * @param {string} command ssh command to be executed
 * @param {function} callback a function will be called if ssh command is successfully done
 */
function execCommand(command, callback) {
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            checkSshError(err);
        }
        callback(out.split("\n"));
    });
}

/**
 * 
 * @param {'ip_v4'|'ip_v6'} version 
 * @param {string} cmd command to execute for route
 * @returns a function that will execute the corresponding route command
 */
function route(version, cmd) {
    return function (callback) {
        execCommand(cmd, function (lines) {
            lines.forEach(function (line) {
                var routeData = line.split(/\s+/gm);
                table.insertRecord(version + ">" + routeData[0], [
                    routeData[0],
                    routeData[1],
                    routeData[2],
                    routeData[3]
                ]);
            });
            callback();
        });
    };
}

/**
 * 
 * @param {[function]} arrayFn An array of functions that will be executed in the same time, each function should have a callback as parameter
 * @param {function} callback This function is called when all functions in arrayFn are done
 */

function executeAll(arrayFn, callback) {
    if (arrayFn.length == 0) {
        callback([]);
    }
    var length = arrayFn.length;
    var results = new Array(length);
    var finished = 0;
    arrayFn.forEach(function (fn, index) {
        fn(function (result) {
            results[index] = result;
            if (++finished == length) {
                callback(results);
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
    execCommand(validateCmd, function () {
        D.success();
    });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    executeAll([
        route("ip_v4", routeV4Cmd),
        route("ip_v6", routeV6Cmd),
    ], function () {
        D.success(table);
    });
}