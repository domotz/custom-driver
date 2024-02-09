/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN HW Sensors Voltage and Current 
 * Description: This script retrieves voltage and current sensor data from an HPE MSA SAN device
 * 
 * Communication protocol is HTTPS 
 * 
 * Tested with HPE MSA 2050 SAN version: VL270P005
 * 
 * Creates a Custom Driver Table with the following columns:
 *     - Value: The measured voltage or current value in volts
 *     - Status: The status of the sensor
 * 
 */

// Variable to store the session key
var sessionKey;

// Create a Custom Driver table to store to store voltage and current sensor data
var table = D.createTable(
    "Voltage and Current Sensors",
    [
        { label: "Value", unit: "V", valueType: D.valueType.NUMBER},
        { label: "Status", valueType: D.valueType.STRING}   
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

// Retrieves voltage and current sensor data from the HPE MSA SAN device
function getVoltageCurrent() {
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
    var sensors = data.match(/<OBJECT basetype="sensors" name="sensor" oid="\d+" format="rows">([\s\S]*?)<\/OBJECT>/g);
    var voltageCurrentSensors = sensors.filter(function(sensor) { 
        return sensor.match(/<PROPERTY name="sensor-type".*?>(Voltage|Current)/);
    });
    if (voltageCurrentSensors.length == 0) {
        console.log("Voltage and current sensors not found");        
        D.failure(D.errorType.PARSING_ERROR);
    }
    for(var i = 0; i < voltageCurrentSensors.length; i++){
        var sensorNameMatch = voltageCurrentSensors[i].match(/<PROPERTY\s+name="sensor-name"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var valueMatch = voltageCurrentSensors[i].match(/<PROPERTY\s+name="value"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var statusMatch = voltageCurrentSensors[i].match(/<PROPERTY\s+name="status"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var sensorName = sensorNameMatch ? sensorNameMatch[1] : "";
        var value = valueMatch ? valueMatch[1] : "";
        var status = statusMatch ? statusMatch[1] : "";
        var recordId = sanitize(sensorName);
        table.insertRecord(recordId, [
            value,
            status
        ]);
    }
    D.success(table);   
}

/**
 * @remote_procedure
 * @label Validate HPE MSA SAN Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    login()
        .then(getVoltageCurrent)
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
 * @label Get Voltage and Current Sensor Data
 * @documentation Retrieves the voltage and current sensor data from the device
 */
function get_status() {
    login()
        .then(getVoltageCurrent)
        .then(extractData)
        .catch(function(error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}