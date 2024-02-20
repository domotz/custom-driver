/**
 * Domotz Custom Driver 
 * Name: Dell PowerVault SAN System General
 * Description: Monitors the general information of a Dell PowerVault SAN system
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on Dell PowerVault ME5024
 *
 * Creates a Custom Driver variables:
 *      - Serial Number: The serial number of the system
 *      - Health: The health status of the system
 *      - Power State: The power state of the system
 * 
 **/

var sessionToken;

// Process the response from the server
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        if (response.headers["x-auth-token"]) {
            sessionToken = response.headers["x-auth-token"];
            if (response.headers["command-status"] && response.headers["command-status"].indexOf("Command failed")) {
                console.log("Session token not found in response headers");
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }     
        } else if (response.headers["command-status"] && response.headers["command-status"].indexOf("Invalid URL")) {
            console.log("Invalid URL");
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);

        } else if (response.statusCode !== 200) {
            console.log(response);
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

// Function to make an HTTP GET request to retrieve information from the Dell PowerVault SAN system
function getSystemInformation() {
    var d = D.q.defer();
    var config = {
        url: "/redfish/v1/Chassis/0",
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

// Extracts data from the response body and populates custom variables
function extractData(data) {
    var health;
    if (data.Status && data.Status.State === "Enabled") {
        health = data.Status.Health;
    } else {
        health = "N/A";
    }

    if (data.SerialNumber || data.PowerState) {
        var serialNumber = data.SerialNumber;
        var powerState = data.PowerState;
        var variables = [
            D.createVariable("serial-number", "Serial Number", serialNumber, null, D.valueType.STRING),
            D.createVariable("health", "Health", health, null, D.valueType.STRING),
            D.createVariable("power-state", "Power State", powerState, null, D.valueType.STRING)
        ];
        D.success(variables);
    } else {
        console.error("Missing required properties in the data");
        D.failure(D.errorType.PARSING_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate Dell PowerVault device
 * @documentation This procedure is used to validate the presence of a Dell PowerVault device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    login()
        .then(getSystemInformation)
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Chassis/0") !== -1) {
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
 * @label Get Dell PowerVault SAN Information
 * @documentation This procedure is used to extract general information about the Dell PowerVault SAN system
 */
function get_status() {
    login()
        .then(getSystemInformation)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}