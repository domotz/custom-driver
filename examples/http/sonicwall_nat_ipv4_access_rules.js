/**
 * Domotz Custom Driver
 * Name: Sonicwall - NAT IPV4 Access Rules
 * Description: Monitors IPv4 access rules for Sonicwall devices
 *
 * Communication protocol is HTTPS
 *
 * Tested on SonicWALL TZ 270 SonicOS version 7.0.1
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Description: Description of the access rule
 *      - Enabled: Indicates whether the access rule is enabled or not
 *      - From: Specifies the source IP or network range
 *      - To: Specifies the destination IP or network range
 *      - Source: Defines the source IP or network for the traffic
 *      - Destination: Specifies the destination IP or network for the traffic
 *      - Action: Describes the action associated with the access rule
 *
 **/

// access_rule_name: Set it to 'ALL' to retrieve all access rules,
// or specify a list of access rules to filter and display only the selected access rules.
var access_rule_name = D.getParameter("accessRuleName");

var table = D.createTable(
    "Access Rules", [
        { label: "Description" },
        { label: "Enabled" },
        { label: "From" },
        { label: "To" },
        { label: "Source" },
        { label: "Destination" },
        { label: "Action" }
    ]
);

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
 * Logs in to the SonicWALL device using basic authentication.
 * @returns A promise that resolves on successful login.
 */
function login() {
    var config = {
        url: "/api/sonicos/auth",
        username: D.device.username(),
        password: D.device.password(),
        port: 8444,
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    return new Promise(function (resolve, reject) {
        D.device.http.post(config, processResponse(function (body) {
            bearerToken = readBearerToken(body);
            resolve(body);
        }, reject));
    });
}

//Retrieves IPv4 Access Rules from the SonicWALL device
function getAccessRules() {
    var config = {
        url: "/api/sonicos/access-rules/ipv4",
        protocol: "https",
        port: 8444,
        jar: true,
        rejectUnauthorized: false
    };
    return new Promise(function (resolve, reject) {
        authenticatedGet(config, processResponse(resolve, reject));
    });
}

function sanitize(output) {
    var recordIdReservedWords = ["\\?", "\\*", "\\%", "table", "column", "history"];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join("|"), "g");
    return output.replace(recordIdSanitisationRegex, "").slice(0, 50).replace(/\s+/g, "-").toLowerCase();
}

//Extracts data from the HTTP response and populates the custom table.
function extractData(body) {
    var data = JSON.parse(body);
    data.access_rules.forEach(function (item) {
        var name = item.ipv4.name;
        var uuid = item.ipv4.uuid;
        if (access_rule_name[0].toLowerCase() === "all" || access_rule_name.some(function (res) {
            return res.toLowerCase() === name.toLowerCase();
        })) {
            var recordId = sanitize(name + "-" + uuid);
            var description = item.ipv4.comment || "-";
            var enabled;
            if (item.ipv4.enable === true || item.ipv4.enable === "true") {
                enabled = "Yes";
            } else {
                enabled = "No";
            }
            var from = item.ipv4.from;
            var to = item.ipv4.to;
            var sourceAddress = "Address: (" + extractValue(item.ipv4.source.address) + ")";
            var sourcePort = "Port: (" + extractValue(item.ipv4.source.port) + ")";
            var source = sourceAddress + " | " + sourcePort;
            var destination = "Address: (" + extractValue(item.ipv4.destination.address) + ")";
            var action = item.ipv4.action;
            table.insertRecord(recordId, [
                description,
                enabled,
                from,
                to,
                source.replace(/true/g, "Yes").replace(/false/g, "No"),
                destination.replace(/true/g, "Yes").replace(/false/g, "No"),
                action
            ]);
        }
    });
    D.success(table);
}

function extractValue(field) {
    if (typeof field === "object") {
        var keys = Object.keys(field);
        console.log(field[keys]);
        return keys + ": " + field[keys];
    }
    return field;
}

/**
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate() {
    login()
        .then(getAccessRules)
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
 * @label Get IPv4 Access Rules
 * @documentation This procedure is used to retrieve IPv4 access rules from the SonicWALL device and populate the custom table.
 */
function get_status() {
    login()
        .then(getAccessRules)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
