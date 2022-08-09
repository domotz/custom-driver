/**
 * This driver extracts many informations for redis process
 * Communication using telnet over the redis port
 * Create a dynamic list of variables containing all redis monitoring informations
 */

var _var = D.device.createVariable;
var telnet = D.device.sendTelnetCommand;
var password = D.device.password();


var redisTelnetParams = {
    port: 6379, // redis remote port
    negotiationMandatory: false,
    timeout: 1000,
    command: "info",
    onConnectCommand: (password ? "auth " + password + "\n" : null)
};

/**
 * 
 * @returns Promise execute telnet command to redis server and ask for redis informations
 */
function getRedisInfo() {
    var d = D.q.defer();
    telnet(redisTelnetParams, function (out, err) {
        if (err) {
            console.error("error while executing command: " + command);
            console.error(err);
            D.failure();
        }
        if (out.indexOf("-NOAUTH") >= 0) {
            console.error("Authentication required");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else {
            d.resolve(out.split("\n"));
        }
    });

    return d.promise;
}

/**
 * 
 * @param {*} results a list of informations for redis
 * @returns monitoring variables
 */
function parseInfo(results) {
    var vars = results.map(function (line) {
        return line.split(":");
    }).filter(function (info) {
        return info.length == 2;
    }).filter(function (info) {
        return !info[0].match(/.*_human$/);
    }).map(function (info) {
        var key = info[0];
        var value = info[1].trim();
        return _var(key, key.split("_").join(" "), value);
    });
    return vars;
}

/**
 * 
 * @param {*} vars monitoring bariables
 */
function success(vars) {
    D.success(vars);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    getRedisInfo()
        .then(function () {
            success();
        }).catch(function (error) {
            console.error(error);
            D.failure();
        });
}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getRedisInfo()
        .then(parseInfo)
        .then(success)
        .catch(function (error) {
            console.error(error);
            D.failure();
        });
}