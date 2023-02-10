
/**
 * This driver extracts docker process info
 * The communication protocol is SSH
 * This driver create a dynamic monitoring variables using the command "docker info"
 * Tested under Docker version 19.03.15, build 99e3ed8919
 */

var createVar = D.device.createVariable;
var dockerInfoCmd = "docker info --format '{{json .}}'";
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000,
    command: dockerInfoCmd
};

function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * 
 * @returns Promise wait for docker system information
 */
function getDockerInfo() {
    var d = D.q.defer();

    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if(err) checkSshError(err);
        d.resolve({ key: "", value: JSON.parse(out) });
        
    });
    return d.promise;
}

var data = [];

/**
 * parse docker info and create variables to monitor
 * @param {{key: string, value: object}} json 
 * @returns  data to monitor
 */
function createDockerInfoVariables(json) {
    var jsonData = json.value;
    for (var key in jsonData) {
        var uid = json.key ? json.key + ":" + key : key;
        if (typeof (jsonData[key]) == "object") {
            if (key == "DriverStatus") {
                for (var i = 0; i < jsonData.DriverStatus.length; i++) {
                    var elem = jsonData.DriverStatus[i];
                    data.push(createVar(
                        elem[0],
                        elem[0],
                        elem[1]
                    ));
                }
            } else {
                if (Array.isArray(jsonData[key])) {
                    data.push(createVar(
                        uid.substring(0, 50),
                        uid,
                        jsonData[key].join(",")
                    ));
                } else {
                    createDockerInfoVariables({ key: uid, value: jsonData[key] });
                }
            }
        } else {
            data.push(createVar(
                uid.substring(0, 50),
                uid,
                jsonData[key]
            ));
        }
    }
    return data;
}

function failure(err) {
    console.log(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to verify if the call of docker command over ssh is successfully done
*/
function validate() {
    getDockerInfo()
        .then(function () {
            D.success();
        }).catch(failure);
}


/**
* @remote_procedure
* @label Get Docker info
* @documentation This procedure is used to call docker service over ssh and extract the result and create variables to monitor
*/
function get_status() {

    getDockerInfo()
        .then(createDockerInfoVariables)
        .then(D.success)
        .catch(failure);

}