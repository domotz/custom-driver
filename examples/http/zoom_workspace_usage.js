/**
 * Domotz Custom Driver
 * Name: Workspace Usage
 * Description: This script retrieves information about Zoom Workspace Usage
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 * Granular Scopes: workspace:read:usage,workspace:read:usage:admin
 *
 * Creates a custom driver variable:
 *    - Workspace In Use
 *    - Workspace Not In Use
 *    - Desk In Use
 *    - Desk Not In Use
 *    - Room In Use
 *    - Room Not In Use
 *
 **/

const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const locationId = D.getParameter("locationId")

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

let accessToken
let workspaceUsage = {}

const variablesDetails = [{
    uid: "workspace-in-use",
    name: "Workspace In Use",
    valueType: D.valueType.NUMBER,
    unit: null,
    extract: function () {return getInUseByKey("total_usage")}
}, {
    uid: "workspace-not-in-use",
    name: "Workspace Not In Use",
    valueType: D.valueType.NUMBER,
    unit: null,
    extract: function() {return getNotInUseByKey("total_usage")}
}, {
    uid: "desk-in-use",
    name: "Desk In Use",
    valueType: D.valueType.NUMBER,
    unit: null,
    extract: function() {return getInUseByKey("desk_usage")}
}, {
    uid: "desk-not-in-use",
    name: "Desk Not In Use",
    valueType: D.valueType.NUMBER,
    unit: null,
    extract: function() {return getNotInUseByKey("desk_usage")}
}, {
    uid: "room-in-use",
    name: "Room In Use",
    valueType: D.valueType.NUMBER,
    unit: null,
    extract: function() {return getInUseByKey("room_usage")}
}, {
    uid: "room-not-in-use",
    name: "Room Not In Use",
    valueType: D.valueType.NUMBER,
    unit: null,
    extract: function() {return getNotInUseByKey("room_usage")}
},]

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures
 * @param {Object} error The error object returned from the HTTP request
 * @param {Object} response The HTTP response object
 */
function checkHTTPError(error, response) {
    if (error) {
        console.error(error)
        D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (response.statusCode !== 200) {
        D.failure(D.errorType.GENERIC_ERROR)
    }
}

/**
 * Processes the login response and extracts the access token
 * @param {Object} d  The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processLoginResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (bodyAsJSON.access_token) {
            accessToken = bodyAsJSON.access_token
            d.resolve()
        } else {
            console.error("Access token not found in response body")
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
    }
}

/**
 * Processes the Webinars Remote Attendee data and handles pagination if necessary.
 * @param {Error|null} error - The error object, if any, from the API response.
 * @param {Object} response - The HTTP response object.
 * @param {Object} d - A deferred object for resolving or rejecting the promise.
 * @param {string} body - The raw response body as a JSON string.
 */
function processVisitorInvitation(error, response, d, body) {
    checkHTTPError(error, response)
    if (error) {
        d.reject(error)
        return
    }
    const bodyAsJSON = JSON.parse(body)

    if (!(bodyAsJSON.desk_usage && bodyAsJSON.desk_usage && bodyAsJSON.desk_usage)) {
        console.error("No Metrics found.")
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    workspaceUsage = bodyAsJSON
    d.resolve()
}

/**
 * Generates the configuration object for the API request.
 * @returns {Object} - The configuration object containing the API endpoint, headers, and options.
 */
function generateConfig() {
    const url = "/v2/workspaces/usage?location_id=" + locationId
    return {
        url: url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieve Webinars Remote Attendee.
 * @returns {promise}
 */
function retrieveVisitorInvitation() {
    const d = D.q.defer()
    const config = generateConfig();
    zoomResources.http.get(config, function (error, response, body) {
        processVisitorInvitation(error, response, d, body);
    })
    return d.promise
}

/**
 * Generates the HTTP configuration for the login API request.
 * @returns {Object} The HTTP configuration.
 */
function generateLoginConf() {
    return {
        url: "/oauth/token", protocol: "https", headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + D._unsafe.buffer.from(clientId + ":" + clientSecret).toString("base64")
        }, form: {
            "grant_type": "account_credentials", "account_id": accountId
        }, rejectUnauthorized: false, jar: true
    };
}

/**
 * Logs in to Zoom using the provided credentials and retrieves an access token
 * @returns {Promise} A promise that resolves when login is successful
 */
function login() {
    const d = D.q.defer()
    const config = generateLoginConf();
    zoomLogin.http.post(config, processLoginResponse(d))
    return d.promise
}

/**
 * Retrieves the "in use" value for a given key from the workspace usage data.
 * @param {string} key - The key to search for in the workspace usage data.
 * @returns {string} - The "in use" value if found, otherwise "N/A".
 */
function getInUseByKey(key) {
    return workspaceUsage && workspaceUsage[key] && workspaceUsage[key]["in_use"] !== undefined
        ? workspaceUsage[key]["in_use"]
        : "N/A";
}

/**
 * Retrieves the "not in use" value for a given key from the workspace usage data.
 * @param {string} key - The key to search for in the workspace usage data.
 * @returns {string} - The "not in use" value if found, otherwise "N/A".
 */
function getNotInUseByKey(key) {
    return workspaceUsage && workspaceUsage[key] && workspaceUsage[key]["not_in_use"] !== undefined
        ? workspaceUsage[key]["not_in_use"]
        : "N/A";
}

/**
 * Extracts variables from the variables details and creates them using `D.createVariable`.
 */
function extractVariables() {
    const variables = variablesDetails.map(function (detail) {
        return D.createVariable(detail.uid, detail.name, detail.extract(), detail.unit, detail.valueType)
    })
    D.success(variables);
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveVisitorInvitation)
        .then(D.success)
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Zoom Webinars Remote Attendee
 * @documentation This procedure retrieves the list of Zoom Webinars Remote Attendee, filters based on roomId, and populates a table with room details
 */
function get_status() {
    login()
        .then(retrieveVisitorInvitation)
        .then(extractVariables)
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}