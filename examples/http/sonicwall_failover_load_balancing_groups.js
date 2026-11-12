/**
 * Domotz Custom Driver
 * Name: Sonicwall - Failover Load Balancing Groups
 * Description: Monitors Sonicwall failover load balancing groups.
 *
 * Communication protocol is HTTPS
 *
 * Tested on SonicWALL TZ370W, SonicOS 7.1.1-7058-R6162
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Group Name: failover group name
 *      - Member Name: failover group member name
 *      - Link Status
 *      - Load balancing status
 *      - Probe status
 *      - Main target status
 *      - Alternate target status
 **/

var sonicWallAPIPort = 443;

var table = D.createTable(
    "Failover Load Balancing Groups", [
        { label: "Group Name" },
        { label: "Member Name" },
        { label: "Link Status" },
        { label: "LB Status" },
        { label: "Probe Status" },
        { label: "Main Target Status" },
        { label: "Alternate Target Status" }
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
        port: sonicWallAPIPort,
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

//Retrieves failover load balanging groups from the SonicWALL device
function getFailoverLBgroups() {
    var config = {
        url: "/api/sonicos/reporting/failover-lb/status/members",
        protocol: "https",
        port: sonicWallAPIPort,
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
    if (data) {
        data.forEach(function (item) {
            var groupName = item.group_name ? item.group_name : "N/A";
            var memberName = item.member_name ? item.member_name : "N/A";
            var recordId = sanitize(item.group_name ? memberName + groupName : memberName);
            var linkstatus = item.link_status ? item.link_status : "N/A";
            var lbstatus = item.lb_status ? item.lb_status : "N/A";
            var probestatus = item.probe_status ? item.probe_status : "N/A";
            var maintargetstatus = item.main_target_status ? item.main_target_status : "N/A";
            var alternatetargetstatus = item.alternate_target_status ? item.alternate_target_status : "N/A";

            table.insertRecord(recordId, [
                groupName,
                memberName,
                linkstatus,
                lbstatus,
                probestatus,
                maintargetstatus,
                alternatetargetstatus
            ]);
        });
    }
    D.success(table);
}

/**
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate() {
    login()
        .then(getFailoverLBgroups)
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
 * @label Get Failover Load Balancing Groups
 * @documentation This procedure is used to retrieve Failover Load Balancing Groups from the SonicWALL firewall and populate the custom table.
 */
function get_status() {
    login()
        .then(getFailoverLBgroups)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
