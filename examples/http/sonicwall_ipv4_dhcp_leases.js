/**
 * Domotz Custom Driver 
 * Name: Sonicwall - IPv4 DHCP Leases
 * Description: Monitors Sonicwall IPv4 DHCP leases. 
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL NSA 3500, NSv 270
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
 * @label Get Sonicwall Product lifecycle
 * @documentation This procedure is used to retrieve the product lifecycle information for a SonicWall device. The product lifecycle includes five phases: Last Day Order (LDO), Active Retirement (ARM), One-Year Support Last Day Order, Limited Retirement Mode (LRM), and End of Support (EOS). 
 * This information is used to monitor the product lifecycle and check when a product is approaching end of support
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
