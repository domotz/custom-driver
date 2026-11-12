/**
 * This driver extracts monitoring information for redis server
 * Communication using telnet over redis port (default 6379)
 * This driver is tested under redis 4.0.9 and 5.0.7
 * The sections monitored by this driver are:
 * - Server info
 * - Clients
 * - Memory
 * - Persistence
 * - Statistics
 * - Replication
 * - CPU
 * - Cluster
 * - Keyspace
 */

var _var = D.device.createVariable;
var telnet = D.device.sendTelnetCommand;

var devicePassword = D.device.password();

var redisTelnetParams = {
    port: 6379,
    negotiationMandatory: false,
    timeout: 5000,
    command: "info",
    onConnectCommand: devicePassword ? "auth " + devicePassword + "\n" : null
};

/**
 * 
 * @returns Promise wait for redis information
 */
function getRedisInfo() {
    var d = D.q.defer();
    telnet(redisTelnetParams, function (out, err) {
        if (err) {
            console.error("error while executing command: " + redisTelnetParams.command);
            failure(err);
        }
        if (!out) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (out.indexOf("-NOAUTH") >= 0) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        d.resolve(out.split("\n"));
    });

    return d.promise;
}

/**
 * 
 * @param {[string]} results list of information returned by redis server
 * @returns monitoring variables
 */
function parseInfo(results) {
    return results.map(function (line) {
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
}


function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    getRedisInfo()
        .then(function () { D.success(); })
        .catch(failure);

}


/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    getRedisInfo()
        .then(parseInfo)
        .then(D.success)
        .catch(failure);
}