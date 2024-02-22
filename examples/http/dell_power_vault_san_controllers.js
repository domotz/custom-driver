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

var sessionToken;

// Create a Custom Driver table to store controller information
var table = D.createTable(
    "Controllers",[
        { label: "Serial Number", valueType: D.valueType.STRING },
        { label: "Health", valueType: D.valueType.STRING }
    ]
);

// Process the response from the server
function processResponse(d) {
    return function process(error, response, body) {
        console.log(response);
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        if (response.headers["x-auth-token"]) {
            sessionToken = response.headers["x-auth-token"];
        } else if (response.headers["command-status"] && response.headers["command-status"].indexOf("Command failed") !== -1) {
            console.error("Session token not found in response headers");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.headers["command-status"] && response.headers["command-status"].indexOf("Invalid URL") !== -1) {
            console.error("Invalid URL");
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }         
        d.resolve(JSON.parse(body));
    };
}

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
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

// Function to make an HTTP GET request to retrieve controllers from the Dell PowerVault SAN system
function getControllers() {
    var d = D.q.defer();
    var config = {
        url: "/redfish/v1/Storage",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            'X-Auth-Token': sessionToken,
        }
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

/**
 * Function to make an HTTP GET request to retrieve information about a specific controller
 * @param {*} memberUrl The URL of the controller
 */
function getControllerInfo(memberUrl) {
    var d = D.q.defer();
    var config = {
        url: memberUrl,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            'X-Auth-Token': sessionToken,
        }
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
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
            if (response && response["@odata.id"].indexOf("/redfish/v1/Storage") !== -1) {
                console.info("Data available");
                D.success();
            } else {
                console.error("Desired link not found");
                D.failure(D.errorType.GENERIC_ERROR);
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
        .then(function (response) {
            if (response && response.Members) {
                var promises = response.Members.map(function (member) {
                    return getControllerInfo(member['@odata.id']);
                });
                return D.q.all(promises);
            } else {
                console.error("No controller information found");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}