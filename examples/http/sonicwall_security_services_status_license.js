/**
 * Domotz Custom Driver 
 * Name: Sonicwall Security Services Status and License
 * Description: Monitors the operational and licensing status of diverse security services on a SonicWALL device
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL NSv 270 SonicOS version 7.0.1
 *
 * Creates a Custom Driver Table with the following columns:
 *  - Status: The operational status of the security services
 *  - Licensed: The licensing status of the security services
 * 
 **/

// The variable "servicesToMonitor" is used to specify the desired services to monitor,
// set to "ALL" to retrieve the status and license for all security services,
// or specify a list of service names to filter and display only the selected services
// Possible values: ["gav", "spyw", "ips", "geoip", "botnet", "appctrl", "dpissl", "dpissh", "cfs", "cass", "cees", "capture"]
var servicesToMonitor = D.getParameter("servicesToMonitor");

var table = D.createTable(
    "Security services status and license", [
        { label: "Status", valueType: D.valueType.STRING },
        { label: "Licensed", valueType: D.valueType.STRING },
    ]
);

//Processes the HTTP response and handles errors
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
            if (body) {
                var responseBody = JSON.parse(body);
                if (responseBody.status && responseBody.status.success === false) {
                    console.error("Check API endpoint:", responseBody.status.info[0].message);
                    D.failure(D.errorType.GENERIC_ERROR);
                }
            }
        }
        d.resolve(JSON.parse(body));
    };
}

/**
 * Logs in to the SonicWALL device using basic authentication.
 * @returns A promise that resolves on successful login.
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/auth",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

// Retrieves security services data from the SonicWALL device.
function getSecurityServices() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/dynamic-file/getDashboardData.json",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts data from the retrieved security services data and creates Custom Driver variables.
function extractData(data) {
    var availableServices = {
        "gav": "Gateway Anti-Virus",
        "spyw": "Anti-Spyware",
        "ips": "Intrusion Prevention and Detection",
        "geoip": "Geo-IP Filter",
        "botnet": "Botnet Filter",
        "appctrl": "Application Control",
        "dpissl": "Deep Packet Inspection SSL",
        "dpissh": "Deep Packet Inspection SSH", 
        "cfs": "Content Filtering",
        "cass": "Anti-Spam Service",
        "cees": "Endpoint security Client Capture",
        "capture": "Capture Advanced Threat Protection"
    };

    for (var serviceId in availableServices) {
        var variableId = serviceId;
        var variableName = availableServices[serviceId];
        if (servicesToMonitor[0].toLowerCase() == "all" || servicesToMonitor.some(function(service) { return service.toLowerCase() === variableId.toLowerCase(); })) {           
            
            if (variableId in data) {
                var status = data[variableId]["status"];
                var serviceStatus = status ? "On" : "Off";
                var licensed = data[variableId]["licensed"];
                var licenseStatus = licensed ? "Yes" : "No";
                var recordId = sanitize(variableName);
                table.insertRecord(recordId, [
                    serviceStatus,
                    licenseStatus
                ]);
                    
            } else {
                console.error("Failed to retrieve data for " + variableId);
            }
        }
    }
    D.success(table);
}

/**
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate(){
    login()
        .then(getSecurityServices)
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
 * @label Get Security Services Status and License
 * @documentation This procedure monitors operational and licensing status of various security services.
 */
function get_status() {
    login()
        .then(getSecurityServices)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}