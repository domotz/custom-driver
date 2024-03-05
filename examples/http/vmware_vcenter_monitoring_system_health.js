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
        { label: "Status", valueType: D.valueType.STRING }
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

var config = [
    { id: "system-health", url: "/api/appliance/health/system" }, //Get overall health of system
    { id: "load", url: "/api/appliance/health/load" }, //Get load health
    { id: "memory-health", url: "/api/appliance/health/mem" }, //Get memory health
    { id: "applmgmt-service-health", url: "/api/appliance/health/applmgmt" }, //Get health status of applmgmt services
    { id: "storage-health", url: "/api/appliance/health/storage" }, //Get storage health
    { id: "swap-health", url: "/api/appliance/health/swap" }, //Get swap health
    { id: "database-storage-health", url: "/api/appliance/health/database-storage" }, //Get database storage health
    { id: "software-updates-availability", url: "/api/appliance/health/software-packages" } //Get information on available software updates available in the remote vSphere Update Manager repository
];

// Function to retrieve system health information
function getSystemHealthInfo(sessionId) {
    var promises = config.map(function (urls) {
        return httpGet(urls.url, sessionId);
    });

    return D.q.all(promises);
}

// This function extracts data from the response and populates the custom table 
function extractData(data) {
    for (var i = 0; i < data.length; i++) {
        var value = data[i] || "N/A";
        var recordId = config[i].id;
        table.insertRecord(recordId, [value]);
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