/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN Controllers
 * Description: This script retrieves information about each controller in an HPE MSA SAN system
 * 
 * Communication protocol is HTTPS 
 * 
 * Tested with HPE MSA 2050 SAN version: VL270P005
 * 
 * Creates a Custom Driver Table with the following columns:
 *     - IP Address: Controller network port IP address
 *     - Disks: Number of disks in the storage system
 *     - Status: Current status of the controller
 *     - Health: Health status of the controller
 *     - Redundancy Mode: Redundancy mode of the controller
 *     - Redundancy Status: Redundancy status of the controller
 * 
 */
// Variable to store the session key
var sessionKey;

// Create a Custom Driver table to store controllers data
var table = D.createTable(
    "Controllers",
    [
        { label: "IP Address", valueType: D.valueType.STRING },
        { label: "Disks", valueType: D.valueType.NUMBER },
        { label: "Status", valueType: D.valueType.STRING }, 
        { label: "Health", valueType: D.valueType.STRING }, 
        { label: "Redundancy Mode", valueType: D.valueType.STRING }, 
        { label: "Redundancy Status", valueType: D.valueType.STRING }
    ]
);

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

// Retrieves controllers data from the HPE MSA SAN device
function getController() {
    var d = D.q.defer();
    var config = {
        url: "/api/show/controllers",
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

// Sanitize sensor name to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response
function extractData(data) {
    var $ = D.htmlParse(data);
    var sensorObjects = $("OBJECT[basetype=\"controllers\"]");
    if (sensorObjects.length == 0) {
        console.error("No fan found in the data");
        D.failure(D.errorType.PARSING_ERROR);
    }
    
    sensorObjects.each(function (index, element) {
        var controllerId = $(element).find("PROPERTY[name=\"controller-id\"]").first().text();
        var ipAddress = $(element).find("PROPERTY[name=\"ip-address\"]").first().text();
        var disks = $(element).find("PROPERTY[name=\"disks\"]").first().text();
        var status = $(element).find("PROPERTY[name=\"status\"]").first().text();
        var health = $(element).find("PROPERTY[name=\"health\"]").first().text();
        var redundancyMode = $(element).find("PROPERTY[name=\"redundancy-mode\"]").first().text();
        var redundancyStatus = $(element).find("PROPERTY[name=\"redundancy-status\"]").first().text();
        var recordId = sanitize(controllerId);
        table.insertRecord(recordId, [
            ipAddress,
            disks,
            status,
            health,
            redundancyMode,
            redundancyStatus
        ]);
    });
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate HPE MSA SAN Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    login()
        .then(getController)
        .then(function (response) {
            var $ = D.htmlParse(response);
            var responseElement = $("RESPONSE");
            var sensorStatus = responseElement.attr("request");
            if (sensorStatus == "show controllers") {
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
 * @label Get Controllers 
 * @documentation Retrieves the Controllers data from the device
 */
function get_status() {
    login()
        .then(getController)
        .then(extractData)
        .catch(function(error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}