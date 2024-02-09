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
    if (!data) {
        console.log("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    } else {
        var controllers = data.match(/<OBJECT basetype="controllers" name="controllers" oid="\d+" format="pairs">([\s\S]*?)<\/OBJECT>/g);
        if (!controllers) {
            console.log("No controllers found in the data");        
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            controllers.forEach(function(controller) {
                var controllerIdMatch = controller.match(/<PROPERTY\s+name="controller-id"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var ipAddresMatch = controller.match(/<PROPERTY\s+name="ip-address"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var disksMatch = controller.match(/<PROPERTY\s+name="disks"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var statusMatch = controller.match(/<PROPERTY\s+name="status"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var healthMatch = controller.match(/<PROPERTY\s+name="health"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var redundancyModeMatch = controller.match(/<PROPERTY\s+name="redundancy-mode"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var redundancyStatusMatch = controller.match(/<PROPERTY\s+name="redundancy-status"\s+[^>]*>(.*?)<\/PROPERTY>/);

                var controllerId = controllerIdMatch ? controllerIdMatch[1] : "";
                var ipAddres = ipAddresMatch ? ipAddresMatch[1] : "";
                var disks = disksMatch ? disksMatch[1] : "";
                var status = statusMatch ? statusMatch[1] : "";
                var health = healthMatch ? healthMatch[1] : "";
                var redundancyMode = redundancyModeMatch ? redundancyModeMatch[1] : "";
                var redundancyStatus = redundancyStatusMatch ? redundancyStatusMatch[1] : "";
                var recordId = sanitize(controllerId);

                table.insertRecord(recordId, [
                    ipAddres,
                    disks,
                    status,
                    health,
                    redundancyMode,
                    redundancyStatus
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
        .then(getController)
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