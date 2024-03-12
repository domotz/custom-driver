/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN Fans
 * Description: This script retrieves fans data from an HPE MSA SAN device
 * 
 * Communication protocol is HTTPS 
 * 
 * Tested with HPE MSA 2050 SAN version: VL270P005
 * 
 * Creates a Custom Driver Table with the following columns:
 *     - Health: Fan Health status 
 *     - Status: Fan unit status
 *     - Speed: Fan speed measured in RPM (Revolutions Per Minute)
 * 
 */

// Variable to store the session key
var sessionKey;

// Create a Custom Driver table to store fans data
var table = D.createTable(
    "Fans",
    [
        { label: "Health", valueType: D.valueType.STRING },
        { label: "Status", valueType: D.valueType.STRING },
        { label: "Speed", unit: "RPM", valueType: D.valueType.NUMBER }
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

// Retrieves fans data from the HPE MSA SAN device
function getFans() {
    var d = D.q.defer();
    var config = {
        url: "/api/show/fans",
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

// Sanitize name value to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response
function extractData(data) {
    var $ = D.htmlParse(data);
    var sensorObjects = $("OBJECT[basetype=\"fan\"]");
    if (sensorObjects.length == 0) {
        console.error("No fan found in the data");
        D.failure(D.errorType.PARSING_ERROR);
    }
    sensorObjects.each(function (index, element) {
        var name = $(element).find("PROPERTY[name=\"name\"]").text();
        var health = $(element).find("PROPERTY[name=\"health\"]").text();
        var status = $(element).find("PROPERTY[name=\"status\"]").text();   
        var speed = $(element).find("PROPERTY[name=\"speed\"]").text();  
        var recordId = sanitize(name);
        table.insertRecord(recordId, [
            health,
            status,
            speed
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
        .then(getFans)
        .then(function (response) {
            var $ = D.htmlParse(response);
            var responseElement = $("RESPONSE");
            var sensorStatus = responseElement.attr("request");
            if (sensorStatus == "show fans") {
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
 * @label Get Fans 
 * @documentation Retrieves the fans data from the device
 */
function get_status() {
    login()
        .then(getFans)
        .then(extractData)
        .catch(function(error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}