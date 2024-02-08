/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN HW Sensors Charge
 * Description: This script retrieves the charge capacity sensor data from an HPE MSA SAN device
 * 
 * Communication protocol is HTTPS 
 * 
 * Tested with HPE MSA 2050 SAN version: VL270P005
 * 
 * Creates a Custom Driver Table with the following columns:
 *     - Value: Represents the value of the sensor
 *     - Status: Indicates the status of the sensor
 * 
 */

// Variable to store the session key
var sessionKey;

// Create a Custom Driver table to store charge capacity sensor data
var table = D.createTable(
    "Charge Capacity",
    [
        { label: "Value", unit: "%", valueType: D.valueType.STRING},
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
            if (!sessionKey) {
                console.error("Session key not found in response headers");
                D.failure(D.errorType.GENERIC_ERROR);
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

// Retrieves Charge Capacity sensor data from the HPE MSA SAN device
function getChargeCapacity() {
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

    console.log(data);
    var sensors = data.match(/<OBJECT basetype="sensors" name="sensor" oid="\d+" format="rows">([\s\S]*?)<\/OBJECT>/g);
    var overallSensors = sensors.filter(function(sensor) { 
        return sensor.match(/<PROPERTY name="sensor-type".*?>Charge Capacity/);
    });
    if (overallSensors.length === 0) {
        console.log("Charge Capacity sensors not found");        
        D.failure(D.errorType.PARSING_ERROR);
    }
    for(var i = 0; i < overallSensors.length; i++){
        var sensorNameMatch = overallSensors[i].match(/<PROPERTY\s+name="sensor-name"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var valueMatch = overallSensors[i].match(/<PROPERTY\s+name="value"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var statusMatch = overallSensors[i].match(/<PROPERTY\s+name="status"\s+[^>]*>(.*?)<\/PROPERTY>/);
        var sensorName = sensorNameMatch ? sensorNameMatch[1] : "";
        var value = valueMatch ? valueMatch[1] : "";
        var status = statusMatch ? statusMatch[1] : "";
        var recordId = sanitize(sensorName);
        table.insertRecord(recordId, [
            value.replace("%", ""),
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
        .then(getChargeCapacity)
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
 * @label Get Charge Capacity Sensor Data
 * @documentation Retrieves the charge capacity sensor data from the device
 */
function get_status() {
    login()
        .then(getChargeCapacity)
        .then(extractData)
        .catch(function(error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}