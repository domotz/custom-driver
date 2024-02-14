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
 *     - Product ID: The product model identifier of the system
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
    var variables = [];
    var $ = D.htmlParse(data);
    var sensorObjects = $("OBJECT[basetype=\"system\"]");
    if (sensorObjects.length == 0) {
        console.error("No system information found in the data");
        D.failure(D.errorType.PARSING_ERROR);
    }
    sensorObjects.each(function (index, element) {
        var productId = $(element).find("PROPERTY[name=\"product-id\"]").text();
        var midplaneSerialNumber = $(element).find("PROPERTY[name=\"midplane-serial-number\"]").text();
        var health = $(element).find("PROPERTY[name=\"health\"]").text();   
        var healthReason = $(element).find("PROPERTY[name=\"health-reason\"]").text();  
        variables.push(D.createVariable("product-id", "Product ID", productId, null, D.valueType.STRING));
        variables.push(D.createVariable("midplane-serial-number", "Midplane Serial Number", midplaneSerialNumber, null, D.valueType.STRING));
        variables.push(D.createVariable("health", "Health", health, null, D.valueType.STRING));
        variables.push(D.createVariable("health-reason", "Health Reason", healthReason, null, D.valueType.STRING));
    });
    D.success(variables);
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
            var $ = D.htmlParse(response);
            var responseElement = $("RESPONSE");
            var sensorStatus = responseElement.attr("request");
            if (sensorStatus == "show system") {
                console.log("Validation successful");
                D.success();
            } else {
                console.error("Validation failed");
                D.failure(D.errorType.PARSING_ERROR);
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