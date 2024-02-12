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
    if (!data) {
        console.log("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    } else {
        var disks = data.match(/<OBJECT basetype="drives" name="drive" oid="\d+" format="rows">([\s\S]*?)<\/OBJECT>/g);
        if (!disks) {
            console.log("No disks found in the data");        
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            disks.forEach(function(disk) {
                var locationMatch = disk.match(/<PROPERTY\s+name="location"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var serialNumberMatch = disk.match(/<PROPERTY\s+name="serial-number"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var usageMatch = disk.match(/<PROPERTY\s+name="usage"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var diskGroupMatch = disk.match(/<PROPERTY\s+name="disk-group"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var poolNameMatch = disk.match(/<PROPERTY\s+name="storage-pool-name"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var tierMatch = disk.match(/<PROPERTY\s+name="storage-tier"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var statusMatch = disk.match(/<PROPERTY\s+name="status"\s+[^>]*>(.*?)<\/PROPERTY>/);
                var healthMatch = disk.match(/<PROPERTY\s+name="health"\s+[^>]*>(.*?)<\/PROPERTY>/);
              
                var location = locationMatch ? locationMatch[1] : "";
                var serialNumber = serialNumberMatch ? serialNumberMatch[1] : "";
                var usage = usageMatch ? usageMatch[1] : "";
                var diskGroup = diskGroupMatch ? diskGroupMatch[1] : "";
                var pool = poolNameMatch ? poolNameMatch[1] : "";
                var tier = tierMatch ? tierMatch[1] : "";
                var status = statusMatch ? statusMatch[1] : "";
                var health = healthMatch ? healthMatch[1] : "";
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
    }
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