/**
 * Domotz Custom Driver
 * Name: Domotz Box System Restart
 * Description: This script provides remote control for restarting the Domotz Box as needed
 *
 * Communication protocol is HTTP
 *
 * Requires Domotz Collector version: 6.8.5 or higher
 **/

function getStatusApi () {
    var deferred = D.q.defer();
    D.device.http.get({
        url: '/api/v1/status',
        port: 3000,
    }, function (error, response, body) {
        if (error) {
            console.error(error);
            deferred.reject(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            deferred.reject(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode != 200) {
            deferred.reject(D.errorType.GENERIC_ERROR);
        } else {
            var json = JSON.parse(body);
            deferred.resolve(json);
        }
    });
    return deferred.promise;
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate () {
    getStatusApi()
    .then(function (json) {
        if (json && json.package && json.package.full_platform === 'ubuntu_core_private') {
            D.success();
        } else {
            var platform = json && json.package && json.package.full_platform;
            console.error('Platform not supported: ' + platform);
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
    })
    .catch(function (error) {
        D.failure(error);
    });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for retrieving device * variables data
 */
function get_status () {
    D.success([]);
}

/**
 * @remote_procedure
 * @label Restart Now
 * @documentation Domotz Box System Restart
 */
function custom_1 () {
    D.device.http.post({
        url: '/api/v1/system-restart',
        port: 3000,
    }, function (error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else {
            D.success();
        }
    });
}