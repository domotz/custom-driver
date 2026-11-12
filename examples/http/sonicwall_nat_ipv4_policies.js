/**
 * Domotz Custom Driver
 * Name: Sonicwall - NAT IPV4 Policies
 * Description: Monitors the Network Address Translation (NAT) policies for IPv4 on a SonicWall device
 *
 * Communication protocol is HTTPS
 *
 * Tested on SonicWALL TZ 270 SonicOS version 7.0.1
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Description: Policy description.
 *      - Enabled: Policy's status.
 *      - Inbound: Inbound policy details.
 *      - Outbound: Outbound policy details.
 *      - Source: Source information for the policy.
 *      - Destination: Destination information for the policy.
 *
 **/

// policy_name set it to 'ALL' to retrieve all policies,
// or specify a list of policy names to filter and display only the selected policies
var policy_name = D.getParameter("policy_name");

var table = D.createTable(
    "NAT Policies", [
        { label: "Description" },
        { label: "Enabled" },
        { label: "Inbound" },
        { label: "Outbound" },
        { label: "Source" },
        { label: "Destination" }
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

//Retrieves NAT IPv4 policies from the SonicWALL device
function getNatPolicies() {
    var config = {
        url: "/api/sonicos/nat-policies/ipv4",
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
    data.nat_policies.forEach(function (item) {
        var name = item.ipv4.name;
        if (policy_name[0].toLowerCase() === "all" || policy_name.some(function (res) {
            return res.toLowerCase() === name.toLowerCase();
        })) {
            var uid = item.ipv4.uuid;
            var recordId = sanitize(name + "-" + uid);
            var description = item.ipv4.comment || "-";
            var enabled;
            if (item.ipv4.enable === true || item.ipv4.enable === "true") {
                enabled = "Yes";
            } else if (item.ipv4.enable === false || item.ipv4.enable === "false") {
                enabled = "No";
            }
            var inbound = item.ipv4.inbound;
            var outbound = item.ipv4.outbound;
            var source = extractValue(item.ipv4.source);
            var destination = extractValue(item.ipv4.destination);
            table.insertRecord(recordId, [
                description,
                enabled,
                inbound,
                outbound,
                source.replace(/true/g, "Yes").replace(/false/g, "No"),
                destination.replace(/true/g, "Yes").replace(/false/g, "No")
            ]);
        }
    });

    D.success(table);
}

// If the field is an object, it extracts the first key and its corresponding value
function extractValue(field) {
    if (typeof field === "object") {
        var keys = Object.keys(field);
        return keys + " : " + field[keys];
    }
    return field;
}

/**
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate() {
    login()
        .then(getNatPolicies)
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
 * @label Get NAT IPv4 policies
 * @documentation This procedure is used to retrieve NAT IPv4 policies from the SonicWALL device and populate the custom table.
 */
function get_status() {
    login()
        .then(getNatPolicies)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
