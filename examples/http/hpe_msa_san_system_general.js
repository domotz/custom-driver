/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN System General
 * Description: Monitors the general information for HPE MSA SAN device
 * 
 * Communication protocol is HTTPS 
 * 
 * Tested with HPE MSA 2050 SAN version: VL270P005
 * 
 * Creates a Custom Driver variables:
 *     - System Name: The name of the storage system
 *     - Midplane Serial Number: The serial number of the controller enclosure midplane
 *     - Health: The health status of the system
 *     - Health Reason: If Health is not OK, the reason for the health state
 * 
 */

// Variable to store the session key
var sessionKey;

// Process the response from the server
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401 || response.statusCode == 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        if (response.headers["command-status"]) {
            sessionKey = response.headers["command-status"].split(/^.*?\s/)[1];
            if(sessionKey == "Authentication Unsuccessful"){
                console.error("Session key not found in response headers");
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
        }
        d.resolve(body);      
    };
}

/**
 * Logs in to the HPE MSA SAN device using basic authentication
 * @returns A promise that resolves on successful login
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/login",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

// Retrieves general information from the HPE MSA SAN device
function getSystemInformation() {
    var d = D.q.defer();
    var config = {
        url: "/api/show/system",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            "sessionKey": sessionKey 
        }
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

// Extracts relevant data from the API response and create variables.
function extractData(data) {
    if (!data) {
        console.log("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    } else {
        var systemInfo = data.match(/<OBJECT basetype="system" name="system-information" oid="\d+" format="pairs">([\s\S]*?)<\/OBJECT>/g);
        if (!systemInfo) {
            console.log("No system information found in the data");
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            var variables = []; 
            systemInfo.forEach(function(system) {  
                var systemNameMatch = system.match(/<PROPERTY\s+name="system-name"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var midplaneSerialNumberMatch = system.match(/<PROPERTY\s+name="midplane-serial-number"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var healthMatch = system.match(/<PROPERTY\s+name="health"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var healthReasonMatch = system.match(/<PROPERTY\s+name="health-reason"\s+[^>]*>(.*?)<\/PROPERTY>/);

                var systemName = systemNameMatch ? systemNameMatch[1] : "";
                var midplaneSerialNumber = midplaneSerialNumberMatch ? midplaneSerialNumberMatch[1] : "";
                var health = healthMatch ? healthMatch[1] : "";
                var healthReason = healthReasonMatch ? healthReasonMatch[1] : "";

                variables.push(D.createVariable("system-name", "System Name", systemName, null, D.valueType.STRING));
                variables.push(D.createVariable("midplane-serial-number", "Midplane Serial Number", midplaneSerialNumber, null, D.valueType.STRING));
                variables.push(D.createVariable("health", "Health", health, null, D.valueType.STRING));
                variables.push(D.createVariable("health-reason", "Health Reason", healthReason, null, D.valueType.STRING));

            });
            D.success(variables);
        }
    }
}

/**
 * @remote_procedure
 * @label Validate HPE MSA SAN Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    login()
        .then(getSystemInformation)
        .then(function (response) {
            var output = response.match(/<PROPERTY name="response".*?>Command completed successfully\. \(.*?\)<\/PROPERTY>/);
            if (!output) {
                console.error("Validation failed");
                D.failure(D.errorType.PARSING_ERROR);
            } else {
                console.log("Validation successful");
                D.success();
            }
        })
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get HPE MSA SAN Information
 * @documentation This procedure is used to extract general information about HPE MSA SAN Device.
 */
function get_status() {
    login()
        .then(getSystemInformation)
        .then(extractData)
        .catch(function(error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}