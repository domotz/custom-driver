/**
 * Domotz Custom Driver
 * Name: Frequent Meeting Cancellations or No-Shows
 * Description: This script retrieves information about Zoom Frequent Meeting Cancellations or No-Shows
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 * Granular Scopes: visitor_management:read:list_invitations,visitor_management:read:list_invitations:admin
 *
 * Creates Custom Driver table with the following columns:
 *    - Cancellation frequency
 **/


const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

let accessToken
let pageToken
let pageSize = 30
let outputCounterByInviteLocation =[]

const cancellationFrequencyTable = D.createTable("Frequent Meeting Cancellations or No-Shows", [
    {label: 'Cancellation frequency', valueType: D.valueType.NUMBER},
    {label: 'Count Invitations', valueType: D.valueType.NUMBER},
    {label: 'Count Cancelled Invitations', valueType: D.valueType.NUMBER}
])

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
 * Updates the invitation counters by invite location.
 * @param {Array} invitations - The list of invitation objects.
 */
function updateInvitationCounters(invitations) {
    invitations.forEach(function (invitation) {
        const locationId = invitation.invite_location_id;
        outputCounterByInviteLocation [locationId] ?
            outputCounterByInviteLocation [locationId]['countInvitations']++ :
            outputCounterByInviteLocation [locationId] =
                {
                    id: locationId,
                    'countInvitations': 1,
                    'canceledInvitation': 0
                }
        if (checkIfNoShowOrCanceledInvitation(invitation)) {
            outputCounterByInviteLocation [locationId]['canceledInvitation']++
        }
    })
}

/**
 * Processes the Visitor Invitation data and handles pagination if necessary.
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

    if (!Array.isArray(bodyAsJSON.invitations) || bodyAsJSON.invitations.length === 0) {
        console.error("No Visitor Invitation found.")
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    updateInvitationCounters(bodyAsJSON.invitations);
    if (bodyAsJSON.next_page_token) {
        pageToken = bodyAsJSON.next_page_token
        retrieveVisitorInvitation()
            .then(function () {
                d.resolve()
            })
            .catch(function (err) {
                console.error("Error fetching next page of Visitor Invitation:", err)
                d.reject(err)
            })
    } else {
        console.log("All Visitor Invitation retrieved successfully.")
        d.resolve()
    }
}

/**
 * Generates the configuration object for the API request.
 * @returns {Object} - The configuration object containing the API endpoint, headers, and options.
 */
function generateConfig() {
    const url = "/v2/visitor/invitation?page_size=" + pageSize
    return {
        url: pageToken ? url + "&next_page_token=" + pageToken : url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieve Visitor Invitation.
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
 * Checks if an invitation has a device_status of "NO_SHOW" or "CANCELED".
 * @param {Object} invitation - The invitation object to check.
 * @returns {boolean} True if the device_status is "NO_SHOW" or "CANCELED", otherwise false.
 */
function checkIfNoShowOrCanceledInvitation(invitation) {
    return invitation.status === "NO_SHOW" || invitation.status === "CANCELED";
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
 * Sanitizes the output by removing reserved words and formatting it
 * @param {string} output The string to be sanitized
 * @returns {string} The sanitized string
 */
function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}


/**
 * Populates all Past Frequent Meeting Cancellations or No-Shows into the output table.
 */
function populateTable() {
    console.log("outputCounterByInviteLocation : ", outputCounterByInviteLocation)
    for (const locationId in outputCounterByInviteLocation) {
        if (outputCounterByInviteLocation.hasOwnProperty(locationId)) {
            const details = outputCounterByInviteLocation[locationId];
            const cancellationFrequency = details.countInvitations ? ((details.canceledInvitation / details.countInvitations ) * 100).toFixed(2) : 100;
            cancellationFrequencyTable.insertRecord(sanitize(locationId), [cancellationFrequency.toString(), details.countInvitations, details.canceledInvitation ]);
        }
    }
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveVisitorInvitation)
        .then(function () {
            D.success()
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Zoom Frequent Meeting Cancellations or No-Shows
 * @documentation This procedure retrieves the list of Zoom Frequent Meeting Cancellations or No-Shows, filters based on roomId, and populates a table with room details
 */
function get_status() {
    login()
        .then(retrieveVisitorInvitation)
        .then(function () {
            populateTable();
            D.success(cancellationFrequencyTable);
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}