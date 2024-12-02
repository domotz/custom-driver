/**
 * Domotz Custom Driver
 * Name: Past Webinars Remote Attendee
 * Description: This script retrieves information about Zoom Past Webinars Remote Attendee
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 * Granular Scopes: webinars:read:list_past_participants,webinars:read:list_past_participants:admin
 *
 * Creates Custom Driver table with the following columns:
 *    - Name
 *    - User ID
 *    - Registrant ID
 *    - User Email
 *    - Join Time
 *    - Leave Time
 *    - Duration
 *    - Failover
 *    - Status
 *    - Internal User
 *
 **/


const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const webinarsId = D.getParameter('webinarsId')
const participantIds = D.getParameter('participantIds')

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

let accessToken
let pageToken
let webinarsRemoteAttendee = []
let pageSize = 30
let id = 1

const webinarsRemoteAttendeeExtractors = [
    {valueType: D.valueType.STRING, key: 'id', extract: getInfoByKey},
    {label: 'Name', valueType: D.valueType.STRING, key: 'name', extract: getInfoByKey},
    {label: 'User ID', valueType: D.valueType.STRING, key: 'user_id', extract: getInfoByKey},
    {label: 'Registrant ID', valueType: D.valueType.STRING, key: 'registrant_id', extract: getInfoByKey},
    {label: 'User Email', valueType: D.valueType.STRING, key: 'user_email', extract: getInfoByKey},
    {label: 'Join Time', valueType: D.valueType.DATETIME, key: 'join_time', extract: getInfoByKey},
    {label: 'Leave Time', valueType: D.valueType.DATETIME, key: 'leave_time', extract: getInfoByKey},
    {label: 'Duration', valueType: D.valueType.NUMBER, unit: 'minutes', key: 'duration', extract: getInfoByKey},
    {label: 'Failover', valueType: D.valueType.STRING, key: 'failover', extract: getInfoByKey},
    {label: 'Status', valueType: D.valueType.STRING, key: 'status', extract: getStatusByKey},
    {label: 'Internal User', valueType: D.valueType.STRING, key: 'internal_user', extract: getInfoByKey}
];

const webinarsRemoteAttendeeProperties = webinarsRemoteAttendeeExtractors.filter(function (row) {
    return row.label
})

const webinarsRemoteAttendeeTable = D.createTable("Past Webinars Remote Attendee", webinarsRemoteAttendeeProperties)

function getStatusByKey(row, key, valueType) {
    return getInfoByKey(row, key, valueType).replace("_", " ")
}

/**
 * Retrieves the value of a specific key from the details property of an object.
 * @param {Object} row
 * @param {string} key
 * @param valueType
 */
function getInfoByKey(row, key, valueType) {
    if(typeof row[key] === "boolean"){
        return row[key] ? "Yes" : "No"
    }else {
        if (row[key]) {
            if (valueType === D.valueType.NUMBER) {
                if (typeof row[key] === "number") {
                    return row[key];
                }
                const match = "" + row[key].match(/-?[\d.]+/);
                return match ? parseFloat(match[0]) : "N/A";
            }
            if (valueType === D.valueType.DATETIME) {
                return row[key].getTime();
            }
            return row[key] || "N/A"
        }
    }
    return "N/A"
}

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
function processWebinarsRemoteAttendee(error, response, d, body) {
    checkHTTPError(error, response)
    if (error) {
        d.reject(error)
        return
    }
    const bodyAsJSON = JSON.parse(body)
    if (!Array.isArray(bodyAsJSON.participants) || bodyAsJSON.participants.length === 0) {
        console.error("No Webinars Remote Attendee found.")
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    webinarsRemoteAttendee = webinarsRemoteAttendee.concat(extractWebinarsRemoteAttendee(bodyAsJSON))
    if (bodyAsJSON.next_page_token) {
        pageToken = bodyAsJSON.next_page_token
        retrieveWebinarsRemoteAttendee()
            .then(function (webinarsRemoteAttendee) {
                d.resolve(webinarsRemoteAttendee)
            })
            .catch(function (err) {
                console.error("Error fetching next page of Webinars Remote Attendee:", err)
                d.reject(err)
            })
    } else {
        console.log("All Webinars Remote Attendee retrieved successfully.")
        d.resolve(webinarsRemoteAttendee)
    }
}

/**
 * Generates the configuration object for the API request.
 * @returns {Object} - The configuration object containing the API endpoint, headers, and options.
 */
function generateConfig() {
    const url = "/v2/past_webinarss/" + webinarsId + "/participants?page_size=" + pageSize
    return {
        url: pageToken ? url + "&next_page_token=" + pageToken : url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieve Webinars Remote Attendee.
 * @returns {promise}
 */
function retrieveWebinarsRemoteAttendee() {
    const d = D.q.defer()
    const config = generateConfig();
    zoomResources.http.get(config, function (error, response, body) {
        processWebinarsRemoteAttendee(error, response, d, body);
    })
    return d.promise
}

/**
 * Extracts relevant information from a Zoom room response
 * @param {Object} webinarsRemoteAttendee The raw Zoom room data
 * @returns {Object} A simplified object with only necessary fields
 */
function extractWebinarsRemoteAttendee(webinarsRemoteAttendee) {
    return webinarsRemoteAttendee.participants.map(function ( participant) {
        return webinarsRemoteAttendeeExtractors.reduce(function (acc, item) {
            acc[item.key] = item.extract ? item.extract(participant, item.key) : "N/A";
            return acc;
        }, {});
    });
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
 * Filters the Zoom Webinars Remote Attendee based on the provided participantIds parameter
 * @param {Array} webinarsRemoteAttendees The list of Zoom Webinars Remote Attendee to filter
 * @returns {Array} A filtered list of Webinars Remote Attendee
 */
function filterWebinarsRemoteAttendee(webinarsRemoteAttendees) {
    return webinarsRemoteAttendees.filter(function (webinarsRemoteAttendee) {
        const participantId = webinarsRemoteAttendee.user_id
        return (participantIds.length === 1 && participantIds[0].toLowerCase() === 'all') || participantIds.some(function (id) {
            return id.toLowerCase() === participantId.toLowerCase()
        })
    })
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
 * Inserts a record into the output table.
 * @param {Object} webinarsRemoteAttendee - The object to insert into the output table.
 */
function insertRecord(webinarsRemoteAttendee) {
    const recordValues = webinarsRemoteAttendeeProperties.map(function (item) {
        return webinarsRemoteAttendee[item.key] || (item.valueType === D.valueType.NUMBER? 0 : 'N/A');
    });
    webinarsRemoteAttendeeTable.insertRecord(sanitize(webinarsRemoteAttendee.id), recordValues);
}

/**
 * Populates all Past Webinars Remote Attendee into the output table.
 * @param {Array} webinarsRemoteAttendees - A list of Past Webinars Remote Attendee objects to be inserted into the table.
 */
function populateTable(webinarsRemoteAttendees) {
    webinarsRemoteAttendees.map(function (webinarsRemoteAttendee) {
        insertRecord(webinarsRemoteAttendee)
    });
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveWebinarsRemoteAttendee)
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
 * @label Get Zoom Webinars Remote Attendee
 * @documentation This procedure retrieves the list of Zoom Webinars Remote Attendee, filters based on roomId, and populates a table with room details
 */
function get_status() {
    login()
        .then(retrieveWebinarsRemoteAttendee)
        .then(function (result) {
            const filteredWebinarsRemoteAttendee = filterWebinarsRemoteAttendee(result)
            populateTable(filteredWebinarsRemoteAttendee);
            D.success(webinarsRemoteAttendeeTable);
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}