/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN Overall Unit Status
 * Description: This script retrieves the overall unit status of an HPE MSA SAN device
 * 
 * Communication protocol is HTTPS 
 * 
 * Tested with HPE MSA 2050 SAN version: VL270P005
 * 
 * Creates a Custom Driver variables for overall unit status
 */

// Variable to store the session key
var sessionKey;

// Process the response from the server
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.headers["command-status"]) {
            sessionKey = response.headers["command-status"].split(/^.*?\s/)[1];
            if (!sessionKey) {
                console.error("Session key not found in response headers");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        }
        d.resolve(body);
    };
}

/**
 * Logs in to the SonicWALL device using basic authentication.
 * @returns A promise that resolves on successful login.
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

// Retrieves Overall Unit Status from the HPE MSA SAN device
function getOverallUnitStatus() {
    var d = D.q.defer();
    var config = {
        url: "/api/show/sensor-status",
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
    var variables = [];
    var sensors = data.match(/<OBJECT basetype="sensors" name="sensor" oid="\d+" format="rows">([\s\S]*?)<\/OBJECT>/g);
    var overallSensors = sensors.filter(function(sensor) { 
        return sensor.match(/<PROPERTY name="sensor-name".*?>Overall Unit Status/);
    });

    if (overallSensors.length === 0) {
        console.log("Overall Unit Status sensors not found");        
        D.failure(D.errorType.PARSING_ERROR);
    }

    for(var i = 0; i < overallSensors.length; i++){
        var sensorNameMatch = overallSensors[i].match(/<PROPERTY\s+name="sensor-name"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var statusMatch = overallSensors[i].match(/<PROPERTY\s+name="status"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var sensorName = sensorNameMatch ? sensorNameMatch[1] : "";
        var status = statusMatch ? statusMatch[1] : "";
        var uid = sanitize(sensorName);
        variables.push(D.createVariable(uid, sensorName, status, null, D.valueType.STRING));
    }
    D.success(variables);   
}

/**
 * @remote_procedure
 * @label Validate HPE MSA SAN Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    login()
        .then(getOverallUnitStatus)
        .then(function (response) {
            if (response.indexOf("Command completed successfully.")) {
                console.info("Validation successful");
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
 * @label Get Overall Unit Status
 * @documentation Retrieves the overall unit status data from the device
 */
function get_status() {
    login()
        .then(getOverallUnitStatus)
        .then(extractData)
        .catch(function(error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
