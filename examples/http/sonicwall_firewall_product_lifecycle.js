/**
 * Domotz Custom Driver
 * Name: Sonicwall firewall - Product lifecycle
 * Description: Extracts the product lifecycle information for a SonicWall device. The product lifecycle includes five phases: Last Day Order (LDO), Active Retirement (ARM), One-Year Support Last Day Order, Limited Retirement Mode (LRM), and End of Support (EOS).
 * This information is used to monitor the product lifecycle and check when a product is approaching end of support
 *
 * Specify which interfaces to monitor based on the provided interfaceName parameter.
 *
 * Communication protocol is HTTPS
 *
 * Tested on SonicWALL NSv 270 SonicOS version 7.0.1-5145
 *
 * The dates come from resources/sonicwall-plc-tables.json in this repository, refreshed from SonicWall's product
 * lifecycle page with resources/sonicwall-plc-refresh.js. A date SonicWall has not published is reported as N/A
 * and its remaining days have no value; so are all dates of a firewall model SonicWall does not list yet.
 *
 * Creates a Custom Driver variables:
 *      - Last Order Day (LOD): The date when the product's last order day is reached
 *      - Active Retirement (ARM): The date when the product's active retirement period begins
 *      - 1 Year Support Last Order Day: The date when the product's one-year support period ends
 *      - Limited Retirement Mode (LRM): The date when the product enters limited retirement mode
 *      - End of Support (EOS): The date when the product's support ends
 *      - LOD - Remaining Days: The number of days remaining until the product's last order day
 *      - ARM - Remaining Days: The number of days remaining until the product's active retirement period begins
 *      - One-Year Support LOD - Remaining Days: The number of days remaining until the product's one-year support period ends
 *      - LRM - Remaining Days: The number of days remaining until the product enters limited retirement mode
 *      - EOS - Remaining Days: The number of days remaining until the product's support ends
 *
 **/

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
    withToken.headers = {};
    for (var name in config.headers) {
        withToken.headers[name] = config.headers[name];
    }
    withToken.headers.Authorization = "Bearer " + bearerToken;
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
 * Generates the HTTP configuration.
 * @param {string} url The URL to connect to
 * @returns {object} The HTTP configuration
 */
function generateConfig(url) {
    return {
        url: url,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false
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
 * Retrieves the firewall model
 * @returns {promise} The promise for the firewall model
 */
function getFirewallModel() {
    var config = generateConfig("/api/sonicos/reporting/status/system");
    return new Promise(function (resolve, reject) {
        authenticatedGet(config, processResponse(resolve, reject));
    });
}

// Create an external device for accessing data from a specific URL
var plcDataSource = D.createExternalDevice("raw.githubusercontent.com");

/**
 * Retrieves the product lifecycle data
 * @returns {promise} The promise for the product lifecycle data
 */
function getProductLifecycleData() {
    var config = {
        url: "/domotz/custom-driver/master/resources/sonicwall-plc-tables.json",
        protocol: "https"
    };
    return new Promise(function (resolve) {
        plcDataSource.http.get(config, function (error, response, body) {
            if (error) {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            } else if (response.statusCode == 404) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            } else if (response.statusCode === 401) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            } else if (response.statusCode != 200) {
                console.error(body);
                D.failure(D.errorType.GENERIC_ERROR);
            } else {
                resolve(JSON.parse(body));
            }
        });
    });
}

/**
 * Reads the model the firewall reports, e.g. "TZ 470" or "NSa 2700"
 * @param {object} body The response body
 * @returns {string} The model, or "" when the firewall did not report one
 */
function extractFirewallModel(body) {
    var data = JSON.parse(body[0]);
    return data && data.model ? String(data.model) : "";
}

/**
 * Reduces a model or series name to what identifies it: no HTML markup, lower case, letters and digits only,
 * so "TZ 470", "TZ470" and "tz-470" compare equal.
 * @param {string} text The name
 * @returns {string} The normalized name
 */
function normalize(text) {
    return String(text || "").replace(/<[^>]*>/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Firewall families the driver runs on. A model of one of these that the lifecycle tables do not list yet
// (SonicWall publishes a model's dates only once it announces its retirement) is reported with N/A dates.
var FIREWALL_FAMILY = /^(tz|nsa|nsv|nssp|sm|supermassive)[0-9]|^soho/;

/**
 * Finds the Hardware row of a model. Most rows name the model without its family ("350" in the TZ Series),
 * newer ones with it ("TZ470"), so a row matches when the model equals the row's name, with or without the
 * family name in front.
 * @param {object} productLifecycle The lifecycle tables, by series
 * @param {string} model The model the firewall reports
 * @returns {object|undefined} The row
 */
function findHardwareRow(productLifecycle, model) {
    var wanted = normalize(model);
    for (var series in productLifecycle) {
        var rows = productLifecycle[series].Hardware;
        var family = normalize(series.replace(/^SonicWall /, "").replace(/ Series$/, ""));
        for (var key in rows) {
            var name = normalize(rows[key].model);
            if (name && (wanted === name || wanted === family + name)) {
                return rows[key];
            }
        }
    }
    return undefined;
}

/**
 * Calculates the remaining days until a phase begins
 * @param {string} phaseDate The date of the phase, or "N/A" when SonicWall has not published it
 * @returns {number|null} The remaining days, 0 once the date has passed, null when there is no date
 */
function calculateRemainingDays(phaseDate) {
    var date = new Date(phaseDate);
    if (isNaN(date.getTime())) {
        return null;
    }
    var remainingDays = Math.ceil((date - new Date()) / (1000 * 60 * 60 * 24));
    return remainingDays >= 0 ? remainingDays : 0;
}

/**
 * Extracts the variables from the product lifecycle data
 * @param {object} info The product lifecycle data
 */
function extractVariables(info) {
    var lastOrderDay = info.lod || "N/A";
    var activeRetirement = info.armb || "N/A";
    var oneYearLastOrder = info.oneyldo || "N/A";
    var limitedRetirementMode = info.lrmb || "N/A";
    var endOfSupport = info.eos || "N/A";
    var lodRemainingDays = calculateRemainingDays(lastOrderDay);
    var armRemainingDays = calculateRemainingDays(activeRetirement);
    var oneyldoRemainingDays = calculateRemainingDays(oneYearLastOrder);
    var lrmRemainingDays = calculateRemainingDays(limitedRetirementMode);
    var eosRemainingDays = calculateRemainingDays(endOfSupport);

    var variables = [
        D.createVariable("lod", "Last Order Day (LOD)", lastOrderDay, null, D.valueType.STRING),
        D.createVariable("arm", "Active Retirement (ARM)", activeRetirement, null, D.valueType.STRING),
        D.createVariable("one-year-lod", "One-Year Support Last Order Day", oneYearLastOrder, null, D.valueType.STRING),
        D.createVariable("lrm", "Limited Retirement Mode (LRM)", limitedRetirementMode, null, D.valueType.STRING),
        D.createVariable("eos", "End of Support (EOS)", endOfSupport, null, D.valueType.STRING),

        D.createVariable("lod-remaining-days", "Last Order Day (LOD) - Remaining Days", lodRemainingDays, "days", D.valueType.NUMBER),
        D.createVariable("arm-remaining-days", "Active Retirement (ARM) -Remaining Days", armRemainingDays, "days", D.valueType.NUMBER),
        D.createVariable("one-year-lod-remaining-days", "One-Year Support Last Order Day - Remaining Days", oneyldoRemainingDays, "days", D.valueType.NUMBER),
        D.createVariable("lrm-remaining-days", "Limited Retirement Mode (LRM) - Remaining Days", lrmRemainingDays, "days", D.valueType.NUMBER),
        D.createVariable("eos-remaining-days", "End of Support (EOS) - Remaining Days", eosRemainingDays, "days", D.valueType.NUMBER)
    ];
    D.success(variables);
}

// Reports the lifecycle of the firewall's model, from its Hardware row in the product lifecycle data
function filtredData(body) {
    var model = extractFirewallModel(body);
    var row = findHardwareRow(body[1], model);
    if (row) {
        return extractVariables(row);
    }
    if (FIREWALL_FAMILY.test(normalize(model))) {
        console.warn("SonicWall has not published lifecycle dates for model \"" + model + "\" yet: reporting N/A");
        return extractVariables({});
    }
    console.error("Model \"" + model + "\" not found in the product lifecycle (PLC) data");
    D.failure(D.errorType.PARSING_ERROR);
}

// Loads the data
function loadData() {
    return Promise.all([
        getFirewallModel(),
        getProductLifecycleData()
    ]);
}

/**
 * @remote_procedure
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate() {
    login()
        .then(loadData)
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
        .then(loadData)
        .then(filtredData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
