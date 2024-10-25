/**
 * Domotz Custom Driver 
 * Name: Sonicwall - IPv4 DHCP Leases
 * Description: Monitors Sonicwall IPv4 DHCP leases. 
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWall NSA 3500 (SonicOS 6.5.4.14-109n), NSv 270 (SonicOS 7.0.1-5119-R4713)
 *
 * Creates the following variables:
 *      - Current: current DHCP leases
 *      - Available Dynamic: available dynamic DHCP leases
 *      - Available Static: available static DHCP leases
 *      - Total Active: total active DHCP leases
 *      - Total Configured: total configured DHCP leases
 **/

var sonicWallAPIPort = 443;

/**
 * Generates the HTTP configuration.
 * @param {string} url The URL to connect to
 * @returns {object} The HTTP configuration
 */
function generateConfig(url) {
    return {
        url: url,
        protocol: "https",
        port: sonicWallAPIPort,
        jar: true,
        rejectUnauthorized: false
    };
}

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
        d.resolve(body);
    };
}


/**
 * Logs in to the SonicWALL device using basic authentication.
 * @returns {promise} The promise for the login operation.
 */
function login() {
    var d = D.q.defer();
    var config = generateConfig("/api/sonicos/auth");
    config.auth = "basic";
    config.username = D.device.username();
    config.password = D.device.password();
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

/**
 * Retrieves DHCP leases info
 * @returns {promise} The promise for retrieving DHCP leases info
 */
function getDHCPLeases() {
    var d = D.q.defer();
    var config = generateConfig("/api/sonicos/reporting/dhcp-server/ipv4/leases/statistic");
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

function getDisplayValue(value) {
  return (value === undefined || value === null || value === '') ? 'N/A' : value
}

/**
 * Extracts the variables from DHCP leases info
 * @param {object} dhcpLeasesBody Body of the DHCP leases API response
 */
function extractVariables(dhcpLeasesBody) {
    var dhcpLeases = JSON.parse(dhcpLeasesBody)

    var current = getDisplayValue(dhcpLeases.current);
    var avaliable_dynamic = getDisplayValue(dhcpLeases.avaliable_dynamic);
    var avaliable_static = getDisplayValue(dhcpLeases.avaliable_static_);
    var total_active = getDisplayValue(dhcpLeases.total_active);
    var total_configured = getDisplayValue(dhcpLeases.total_configured);

    var variables = [
        D.createVariable("current", "Current", current, null, D.valueType.NUMBER),
        D.createVariable("avaliable_dynamic", "Available Dynamic", avaliable_dynamic, null, D.valueType.NUMBER),
        D.createVariable("avaliable_static", "Available Static", avaliable_static, null, D.valueType.NUMBER),
        D.createVariable("total_active", "Total Active", total_active, null, D.valueType.NUMBER),
        D.createVariable("total_configured", "Total Configured", total_configured, null, D.valueType.NUMBER),
    ];
    D.success(variables);
}


/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate(){
    login()
        .then(getDHCPLeases)
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
 * @label Get Sonicwall firewall IPv4 DHCP leases
 * @documentation This procedure is used to retrieve IPv4 DHCP leases statistics from a SonicWall firewall.
 */
function get_status() {
    login()
        .then(getDHCPLeases)
        .then(extractVariables)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
