/**
 * Name: SonicWall Firewall Backup configuration
 * Description: This Configuration Management Script Extracts the SonicWall Firewall configuration and backs it up
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWall SonicOS Version 7.1.1-7058
 * 
 * Creates a configuration backup
 * 
 **/

/**
 * @description Port Number
 * @type NUMBER 
 */
var portNumber = D.getParameter('portNumber');

//Processes the HTTP response and handles errors
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        }
        d.resolve(body)
    };
}

/**
 * Logs in to the SonicWALL device using basic authentication
 * @returns A promise that resolves on successful login
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/auth",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        port: portNumber,
        jar: true,
        rejectUnauthorized: false
    }
    D.device.http.post(config, processResponse(d))
    return d.promise
}

/**
 * This function sends an HTTPS GET request to the SonicWall Firewall device to obtain the configuration backup
 * @returns {Promise} A promise that resolves to the configuration backup
 */
function getConfigBackup() {
    var d = D.q.defer()
    var config = {
        url: "/api/sonicos/config/current",
        protocol: "https",
        port: portNumber,
        jar: true,
        rejectUnauthorized: false,
    }
    D.device.http.get(config, processResponse(d))
    return d.promise
}

/**
* @remote_procedure
* @label Validate Association for Backup
* @documentation This procedure is used to validate if the device is correctly associated and performs the backup process
*/
function validate(){
    login()
        .then(getConfigBackup)
        .then(function(deviceConfiguration) {
            if (deviceConfiguration && Object.keys(deviceConfiguration).length > 0) {
                console.log("Validation successful")
                D.success()
            } else {
                console.error("Validation failed")
                D.failure(D.errorType.RESOURCE_UNAVAILABLE)
            }
        })
        .catch(function(err) {
            console.error('Error in backup procedure:', err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
} 

/**
* @remote_procedure
* @label Backup Device Configuration
* @documentation This procedure backs up the Sonicwall Firewall device configuration 
*/
function backup(){
    login()
        .then(getConfigBackup)
        .then(function(deviceConfiguration) {
            if (deviceConfiguration && Object.keys(deviceConfiguration).length > 0) {
                var backup = JSON.parse(deviceConfiguration)
                var backupResult = D.createBackup({
                    label: "Device Configuration",
                    running: JSON.stringify(backup, null, 1),
                    ignoredLines: [
                        "^\\s*\"system_time\"\\s*:\\s*\".*\",?",
                        "^\\s*\"system_uptime\"\\s*:\\s*\".*\",?",
                        "^\\s*\"password\"\\s*:\\s*\"6,.*\",?",
                        "^\\s*\"confirm_secret\"\\s*:\\s*\"6,.*\",?",
                        "^\\s*\"shared_secret\"\\s*:\\s*\"6,.*\",?",
                        "^\\s*\"secret\"\\s*:\\s*\"6,.*\",?",
                        "^\\s*\"user_password\"\\s*:\\s*\"6,.*\",?",
                        "^\\s*\"passphrase\"\\s*:\\s*\"6,.*\",?",
                        "^\\s*\"smtp_pass\"\\s*:\\s*\"6,.*\",?",
                        "^\\s*\"connection_profile\"\\s*:\\s*\\{.*\\},?"
                    ] 
                })
                D.success(backupResult)
            } else {
                console.error("Unparsable output")
                D.failure(D.errorType.RESOURCE_UNAVAILABLE)
            }
        })
        .catch(function(err) {
            console.error('Error in backup procedure:', err)
            D.failure(D.errorType.GENERIC_ERROR);
        })
}