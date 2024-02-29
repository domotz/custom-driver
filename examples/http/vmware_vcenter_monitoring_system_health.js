/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring System Health
 * Description: This script is designed to retrieve system health information from a VMware vCenter server
 *               
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 8.0.2
 *
 * Creates a Custom Driver table with the system health information
 *
 **/

// Create a Custom Driver table to store system health information
var table = D.createTable(
    "System Health", [
        { label: "Value", valueType: D.valueType.STRING }
    ]
);

// Function to login to the VMWare vCenter
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/session",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 201) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

/**
 * Function to perform HTTP GET request
 * @param {string} url The URL to send the GET request to
 * @param {object} sessionId The response from the login request, containing the session ID
 * @returns A promise containing the body of the response
 */
function httpGet(url, sessionId) {
    var d = D.q.defer();
    var config = {
        url: url,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            "vmware-api-session-id": sessionId
        }
    };
    D.device.http.get(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode != 200) {
            console.log(response.body);
            d.resolve("N/A");
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// Function to get URLs for system health information
function getHealthSystemsUrls(url) {
    return function(sessionId) {
        return httpGet(url, sessionId);
    };
}

// Function to retrieve system health information
function getSystemHealthInfo(sessionId) {
    return D.q.all([
        getHealthSystemsUrls("/api/appliance/health/system")(sessionId), //Get overall health of system
        getHealthSystemsUrls("/api/appliance/health/load")(sessionId), //Get load health
        getHealthSystemsUrls("/api/appliance/health/mem")(sessionId), //Get memory health
        getHealthSystemsUrls("/api/appliance/health/applmgmt")(sessionId), //Get health status of applmgmt services
        getHealthSystemsUrls("/api/appliance/health/storage")(sessionId), //Get storage health
        getHealthSystemsUrls("/api/appliance/health/swap")(sessionId), //Get swap health
        getHealthSystemsUrls("/api/appliance/health/database")(sessionId), //Returns the health status of the database
        getHealthSystemsUrls("/api/appliance/health/database-storage")(sessionId), //Get database storage health
        getHealthSystemsUrls("/api/appliance/health/software-packages")(sessionId) //Get information on available software updates available in the remote vSphere Update Manager repository
    ]);
}

// This function extracts data from the response and populates the custom table 
function extractData(data) {
    var recordIds = [
        "system-health",
        "load",
        "memory-health",
        "applmgmt-service-health",
        "storage-health",
        "swap-health",
        "database-health",
        "database-storage-health",
        "software-updates-availability"
    ];

    for (var i = 0; i < data.length; i++) {
        var value = data[i] || "N/A";
        table.insertRecord(recordIds[i], [value]);
    }

    D.success(table); 
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare vCenter device
 */
function validate(){
    login()
        .then(getSystemHealthInfo)
        .then(function (response) {
            if (response) {
                console.info("Data available");
                D.success();
            } else {
                console.error("No data available");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get VMware vCenter System Health Info
 * @documentation This procedure is used to retrieve system health information from the VMware vCenter server
 */
function get_status() {
    login()
        .then(getSystemHealthInfo)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}