/**
 * Domotz Custom Driver 
 * Name: HPE MSA SAN Disks
 * Description: This script retrieves information about each disk in an HPE MSA SAN system
 * 
 * Communication protocol is HTTPS 
 * 
 * Tested with HPE MSA 2050 SAN version: VL270P005
 * 
 * Creates a Custom Driver Table with the following columns:
 *     - Serial Number: The serial number of the disk
 *     - Usage: The disk usage
 *     - Disk Group: The name of the disk group that contains the disk
 *     - Pool: The pool name to which the disk belongs 
 *     - Tier: The tier of the disk 
 *     - Status: The status of he disk
 *     - Health: The health status of the disk
 * 
 */

// Variable to store the session key
var sessionKey;

// Create a Custom Driver table to store disks data
var table = D.createTable(
    "Disks",
    [
        { label: "Serial Number", valueType: D.valueType.STRING },
        { label: "Usage", valueType: D.valueType.STRING },
        { label: "Disk Group", valueType: D.valueType.STRING },
        { label: "Pool", valueType: D.valueType.STRING },
        { label: "Tier", valueType: D.valueType.STRING },
        { label: "Status", valueType: D.valueType.STRING },
        { label: "Health", valueType: D.valueType.STRING },
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

// Retrieves disks data from the HPE MSA SAN device
function getDisks() {
    var d = D.q.defer();
    var config = {
        url: "/api/show/disks",
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

// Sanitize location value to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response
function extractData(data) {
    var $ = D.htmlParse(data);
    var sensorObjects = $("OBJECT[basetype=\"drives\"]");
    if (sensorObjects.length == 0) {
        console.error("No disks found in the data");
        D.failure(D.errorType.PARSING_ERROR);
    }
    sensorObjects.each(function (index, element) {
        var location = $(element).find("PROPERTY[name=\"location\"]").text();
        var serialNumber = $(element).find("PROPERTY[name=\"serial-number\"]").text();
        var usage = $(element).find("PROPERTY[name=\"usage\"]").text();
        var diskGroup = $(element).find("PROPERTY[name=\"disk-group\"]").text();
        var pool = $(element).find("PROPERTY[name=\"storage-pool-name\"]").text();
        var tier = $(element).find("PROPERTY[name=\"storage-tier\"]").text();
        var status = $(element).find("PROPERTY[name=\"status\"]").text();
        var health = $(element).find("PROPERTY[name=\"health\"]").text();
        var recordId = sanitize(location);
        table.insertRecord(recordId, [
            serialNumber,
            usage,
            diskGroup,
            pool,
            tier,
            status,
            health
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
        .then(getDisks)
        .then(function (response) {
            var $ = D.htmlParse(response);
            var responseElement = $("RESPONSE");
            var sensorStatus = responseElement.attr("request");
            if (sensorStatus == "show disks") {
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
 * @label Get Disks 
 * @documentation Retrieves the disks data from the device
 */
function get_status() {
    login()
        .then(getDisks)
        .then(extractData)
        .catch(function(error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}