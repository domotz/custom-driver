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

// SonicOS can require a bearer token on every API request after login ("Non-GUI Management Login Bearer
// Token Session Check", on by default from SonicOS 7.3.4-7015). When it does, the login reply carries the
// token in status.info[].bearer_token; a firewall with the check off returns none.
var bearerToken = null;

/**
 * Reads the bearer token from the login reply.
 * @param {string|object} body The login reply
 * @returns {string|null} The token, or null when the firewall did not return one
 */
function readBearerToken(body) {
    try {
        var reply = typeof body === "string" ? JSON.parse(body) : body;
        var info = reply && reply.status && reply.status.info;
        for (var i = 0; info && i < info.length; i++) {
            if (info[i] && info[i].bearer_token) {
                return info[i].bearer_token;
            }
        }
    } catch (e) {
        console.warn("The login reply is not JSON, no bearer token read");
    }
    return null;
}

/**
 * Sends a GET to the SonicOS API. When the login returned a bearer token the request carries it instead of
 * the session cookie; if the firewall refuses the token (401) the request is sent once more with the cookie.
 * @param {object} config The HTTP configuration
 * @param {function} callback Called with (error, response, body)
 */
function authenticatedGet(config, callback) {
    if (!bearerToken) {
        D.device.http.get(config, callback);
        return;
    }
    var withToken = {};
    for (var key in config) {
        if (key !== "jar") {
            withToken[key] = config[key];
        }
    }
    withToken.headers = { Authorization: "Bearer " + bearerToken };
    D.device.http.get(withToken, function (error, response, body) {
        if (!error && response && response.statusCode == 401) {
            console.warn("The firewall refused the bearer token (401), retrying with the session cookie");
            D.device.http.get(config, callback);
            return;
        }
        callback(error, response, body);
    });
}

//Processes the HTTP response and handles errors
function processResponse(resolve, reject) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            return D.failure(D.errorType.GENERIC_ERROR);
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
        resolve(body);
    };
}

/**
 * Logs in to the SonicWALL device using basic authentication.
 * @returns {promise} The promise for the login operation.
 */
function login() {
    var config = generateConfig("/api/sonicos/auth");
    config.auth = "basic";
    config.username = D.device.username();
    config.password = D.device.password();
    return new Promise(function (resolve, reject) {
        D.device.http.post(config, processResponse(function (body) {
            bearerToken = readBearerToken(body);
            resolve(body);
        }, reject));
    });
}

/**
 * Retrieves DHCP leases info
 * @returns {promise} The promise for retrieving DHCP leases info
 */
function getDHCPLeases() {
    var config = generateConfig("/api/sonicos/reporting/dhcp-server/ipv4/leases/statistic");
    return new Promise(function (resolve, reject) {
        authenticatedGet(config, processResponse(resolve, reject));
    });
}

function getDisplayValue(value) {
    return (value === undefined || value === null || value === "") ? "N/A" : value;
}

/**
 * Extracts the variables from DHCP leases info
 * @param {object} dhcpLeasesBody Body of the DHCP leases API response
 */
function extractVariables(dhcpLeasesBody) {
    var dhcpLeases = JSON.parse(dhcpLeasesBody);

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
        D.createVariable("total_configured", "Total Configured", total_configured, null, D.valueType.NUMBER)
    ];
    D.success(variables);
}

/**
 * @remote_procedure
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate() {
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
