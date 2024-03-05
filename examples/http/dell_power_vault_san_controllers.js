/**
 * Domotz Custom Driver 
 * Name: Dell PowerVault SAN Controllers
 * Description: This script retrieves information about storage controllers of a Dell PowerVault SAN system using the Redfish API.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on Dell PowerVault ME5024
 *
 * Creates a Custom Driver table with the following columns:
 *      - Serial Number: The serial number of the controller
 *      - Health: The health status of the controller
 * 
 **/

// Create a Custom Driver table to store controller information
var table = D.createTable(
    "Controllers",[
        { label: "Serial Number", valueType: D.valueType.STRING },
        { label: "Health", valueType: D.valueType.STRING }
    ]
);

/**
 * Logs in to the Dell PowerVault SAN system
 * @returns A promise object representing the login process
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/redfish/v1/SessionService/Sessions/",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        body: JSON.stringify({
            "UserName": D.device.username(),
            "Password": D.device.password() 
        })
    };
    D.device.http.post(config, function(error, response, body){
        if (error) {  
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);                     
        } else {
            if (response.headers && response.headers["command-status"] && response.headers["command-status"].indexOf("Invalid session key") !== -1) {
                console.error("Invalid session key found in response headers");
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            if (response.headers && response.headers["command-status"] && response.headers["command-status"].indexOf("Command failed") !== -1) {
                console.error("Command failed found in response headers");
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
            
            var sessionToken = response.headers["x-auth-token"];
            d.resolve(sessionToken);
        }            
    });
    return d.promise;
}

/**
 * Sends an HTTP GET request
 * @param {string} url The URL to perform the GET request
 * @param {string} sessionToken The session token for authentication
 * @returns A promise that resolves with the HTTP response body
 */
function httpGet(url, sessionToken) {
    var d = D.q.defer();
    var config = {
        url: url,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            'X-Auth-Token': sessionToken
        }
    };
    D.device.http.get(config, function(error, response, body){
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);  
        }
        if (response.statusCode !== 200) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);  
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// Function to make an HTTP GET request to retrieve controllers from the Dell PowerVault SAN system
function getControllers(sessionToken){
    return httpGet("/redfish/v1/Storage", sessionToken)
        .then(function(controllers){
            if (controllers && controllers.Members) {
                var promises = controllers.Members.map(function (member) {
                    return getControllerInfo(member['@odata.id'], sessionToken);
                });
                return D.q.all(promises);
            } else {
                console.error("Invalid response or missing Members array");
                D.failure(D.errorType.GENERIC_ERROR);                     

            } 
        })
        .catch(function(err) {
            console.error("Error retrieving controller info " + err);
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        });
}

/**
 * Retrieves information about a specific controller
 * @param {string} controllerUrl The URL of the controller
 * @returns A promise representing the retrieval of controller information
 */
function getControllerInfo(controllerUrl, sessionToken) {
    return httpGet(controllerUrl, sessionToken);
}


// Sanitize name to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts data from the response body and populates custom table
function extractData(controllerInfos) {
    controllerInfos.forEach(function (controllerInfo) {
        if (controllerInfo && controllerInfo.StorageControllers && controllerInfo.StorageControllers.length > 0) {
            controllerInfo.StorageControllers.forEach(function(controller){
                var name = controller.Name || ""; 
                var serialNumber = controller.SerialNumber || ""; 
                var status = controller.Status && controller.Status.Health ? controller.Status.Health : "";
                var recordId = sanitize(name);
                table.insertRecord(
                    recordId, [
                        serialNumber,
                        status
                    ]
                );
            });
        } else {
            console.error("No information available");
            D.failure(D.errorType.GENERIC_ERROR);
        }
    });
    D.success(table);
}


/**
 * @remote_procedure
 * @label Validate Dell PowerVault device
 * @documentation This procedure is used to validate the presence of a Dell PowerVault device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    login()
        .then(getControllers)
        .then(function (response) {
            if (response && response.length > 0) {
                console.log("Validation successful");
                D.success();
            } else {
                console.error("Validation failed");
                D.failure(D.errorType.PARSING_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Controllers
 * @documentation This procedure is used to extract information about a specific controller from the Dell PowerVault SAN system
 */
function get_status() {
    login()
        .then(getControllers)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}