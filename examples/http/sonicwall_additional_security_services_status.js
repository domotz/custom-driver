/**
 * Domotz Custom Driver 
 * Name: Sonicwall Additional security services status
 * Description: Monitors the status of additional security services on a SonicWALL device
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL NSv 270 SonicOS version 7.0.1
 *
 * Creates a Custom Driver variables: 
 *  - Content Filtering
 *  - DNS security
 *  - Anti-Spam Service
 *  - Endpoint security - Client Capture
 *  - Capture Advanced Threat Protection
 * 
 **/

// The variable "servicesToMonitor" is used to specify the desired service(s) to monitor,
// it is set to "ALL" to retrieve status for all gateway security services,
// or specify a list of service names to filter and display only the selected services
// Possible servicesToMonitor values: ["cfs", "dns", "cass", "cees", "capture"]
var servicesToMonitor =  D.getParameter("servicesToMonitor");


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
            D.failure(D.errorType.GENERIC_ERROR);
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
        rejectUnauthorized: false
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

// Retrieves DNS Security services data from the SonicWALL device.
function getDNSSecurityServices() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/dns-security/dns-sinkhole/base",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

// Extracts data from the retrieved additional security services data and creates Custom Driver variables.
function extractData(data) {
    var availableServices = {
        "cfs": "Content Filtering",
        "dns": "DNS security Service",
        "cass": "Anti-Spam Service",
        "cees": "Endpoint security - Client Capture",
        "capture": "Capture Advanced Threat Protection"
    };

    var variables = [];
    var serviceStatus;
    if (servicesToMonitor[0].toUpperCase() === "ALL") {
        for (var service in availableServices) {
            var uid = service;
            var label = availableServices[service];
            var serviceData = data[0][service];

            if (service === "dns") {
                serviceData = data[1]["dns_security"] && data[1]["dns_security"]["dns_sinkhole"];
                serviceStatus = serviceData && serviceData.enable !== undefined ? serviceData.enable : "";
            } else {
                serviceStatus = serviceData && serviceData.status !== undefined ? serviceData.status : serviceData && serviceData.licensed || "";
            }

            variables.push(D.createVariable(uid, label, serviceStatus, null, D.valueType.STRING));
        }
    } else {
        servicesToMonitor.forEach(function (service) {
            var serviceID = service.toLowerCase();
            if (availableServices[serviceID]) {
                var uid = serviceID;
                var label = availableServices[serviceID];
                var serviceData = data[0][serviceID];

                if (serviceID === "dns") {
                    serviceData = data[1]["dns_security"] && data[1]["dns_security"]["dns_sinkhole"];
                    serviceStatus = serviceData && serviceData.enable !== undefined ? serviceData.enable : "";
                } else {
                    serviceStatus = serviceData && serviceData.status !== undefined ? serviceData.status : serviceData && serviceData.licensed || "";
                }

                variables.push(D.createVariable(uid, label, serviceStatus, null, D.valueType.STRING));
            }
        });
    }

    D.success(variables);
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
 * @label Get Additional Security Services Status
 * @documentation This procedure monitors the status of various additional security services.
 */
function get_status() {
    login()
        .then(function () {
            return D.q.all([
                getSecurityServices(),
                getDNSSecurityServices()
            ]);
        })
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}