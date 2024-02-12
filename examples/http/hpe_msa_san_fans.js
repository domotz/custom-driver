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

// Sanitize sensor name to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response
function extractData(data) {
    if (!data) {
        console.log("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    } else {
        var fans = data.match(/<OBJECT basetype="fan" name="fan-details" oid="\d+" format="rows">([\s\S]*?)<\/OBJECT>/g);
        if (!fans) {
            console.log("No fans found in the data");        
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            fans.forEach(function(fan) {
                var nameMatch = fan.match(/<PROPERTY\s+name="name"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var healthMatch = fan.match(/<PROPERTY\s+name="health"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var statusMatch = fan.match(/<PROPERTY\s+name="status"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var speedMatch = fan.match(/<PROPERTY\s+name="speed"\s+[^>]*>(.*?)<\/PROPERTY>/);
              
                var name = nameMatch ? nameMatch[1] : "";
                var health = healthMatch ? healthMatch[1] : "";
                var status = statusMatch ? statusMatch[1] : "";
                var speed = speedMatch ? speedMatch[1] : "";
                var recordId = sanitize(name);
                table.insertRecord(recordId, [
                    health,
                    status,
                    speed
                ]);
            });
            D.success(table);   
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
        .then(getFans)
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