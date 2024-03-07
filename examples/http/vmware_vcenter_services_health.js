/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring Services Health
 * Description: Monitors the health status of services on a VMware vCenter server.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 7.0.3
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Startup Type: Defines valid Startup Type for vCenter Server services
 *      - State: Defines valid Run State for services
 *      - Status: Defines the health of a service
 * 
 **/

// Create a Custom Driver table to store health status of vCenter services
var table = D.createTable(
    "vCenter Services Health",
    [
        { label: "Startup Type", valueType: D.valueType.STRING },
        { label: "State", valueType: D.valueType.STRING },
        { label: "Status", valueType: D.valueType.STRING }
    ]
);

// Logs in to the VMWare device using basic authentication.
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

// This function retrieves the list of services from the VMWare API
function getServices(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/api/vcenter/services",
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
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// This function extracts data from the response body and populates the custom table 
function extractData(data) {
    if (data) {
        var healthStatus = {
            "HEALTHY": "OK",
            "DEGRADED": "NOT OK",
            "HEALTHY_WITH_WARNINGS": "WARNING"
        };

        for (var key in data) {
            var serviceName = key;
            var startupType = data[key].startup_type || "";
            var state = data[key].state || "";
            var statusValue = data[key].health || "";
            var status = healthStatus[statusValue] || "";
            var recordId = sanitize(serviceName);
            table.insertRecord(recordId, [
                startupType,
                state,
                status
            ]);
        }
        D.success(table);
    } else {
        console.log("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare device
 */
function validate(){
    login()
        .then(getServices)
        .then(function (response) {
            if (response && Object.keys(response).length > 0) {
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
 * @label Get VMware vCenter Services Health
 * @documentation This procedure is used to retrieve the health status of vCenter services from the VMWare device
 */
function get_status() {
    login()
        .then(getServices)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}