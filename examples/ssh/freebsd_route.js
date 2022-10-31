
/**
 * This driver extracts information about network routes in freebsd os
 * The communication protocol is SSH
 * This driver create a dynamic monitoring variables for the routes for ip V6 and V4
 * Tested under freebsd 12.3-STABLE
 */



var validate_cmd = "netstat -r -n";
var route_v4_cmd = "netstat -4 -r -n | tail -n +5";
var route_v6_cmd = "netstat -6 -r -n | tail -n +5";

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

function exec_command(command, callback) {
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            console.error("error while executing command: " + command);
            console.error(err);
            D.failure();
        }
        callback(out.split("\n"));
    });
}

function route(version, cmd) {
    return function (callback) {
        exec_command(cmd, function (lines) {
            lines.forEach(function (line) {
                var route_data = line.split(/\s+/gm);
                table.insertRecord(version + ">" + route_data[0], [
                    route_data[0],
                    route_data[1],
                    route_data[2],
                    route_data[3]
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

function execute_all(arrayFn, callback) {
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
* @documentation This procedure is used to validate if the ssh commands are running successfully
*/
function validate() {
    exec_command(validate_cmd, function () {
        D.success();
    });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device routing table
*/
function get_status() {
    execute_all([
        route("ip_v4", route_v4_cmd),
        route("ip_v6", route_v6_cmd),
    ], function () {
        D.success(table);
    });
}