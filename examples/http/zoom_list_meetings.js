/**
 * Domotz Custom Driver
 * Name: Zoom - List meetings
 * Description: This script retrieves information about Zoom scheduled meetings
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 *    - Granular Scopes: meeting:read:list_meetings,meeting:read:list_meetings:admin
 * 
 * Creates Custom Driver table with the following columns:
 *    - Creation Timestamp: The timestamp when the meeting was created
 *    - Duration: The scheduled duration of the meeting
 *    - Host ID: The unique identifier for the Zoom user hosting the meeting
 *    - Personal ID: A unique identifier for the personal meeting room of the host
 *    - Start Time: The start time of the scheduled meeting
 *    - Timezone: The timezone in which the meeting is scheduled
 *    - Topic: The title or subject of the meeting
 *    - Type: The type of the meeting
 *    - Unique meeting UUID: The globally unique identifier (UUID) for the meeting instance
 *
 **/

const accountId = D.getParameter('accountId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')

const zoomLogin = D.createExternalDevice('zoom.us')
const zoomResources = D.createExternalDevice('api.zoom.us')

const meetingId = D.getParameter('meetingId')

let accessToken
let pageToken
let meetings = []
let pageSize = 30

const meetingsExtractors = [
    {valueType: D.valueType.NUMBER, key: 'id', extract: getInfoByKey},
    {label: 'Creation Timestamp', valueType: D.valueType.DATETIME, key: 'created_at', extract: function(row){return formatDateTime(row.created_at)}},
    {label: 'Duration', unit: 'Min', valueType: D.valueType.NUMBER, key: 'duration', extract: getInfoByKey},
    {label: 'Host ID', valueType: D.valueType.STRING, key: 'host_id', extract: getInfoByKey},
    {label: 'Personal ID', valueType: D.valueType.STRING, key: 'pmi', extract: getInfoByKey},
    {label: 'Start Time', valueType: D.valueType.DATETIME, key: 'start_time', extract: function(row){return formatDateTime(row.start_time)}},
    {label: 'Timezone', valueType: D.valueType.STRING, key: 'timezone', extract: getInfoByKey},
    {label: 'Topic', valueType: D.valueType.STRING, key: 'topic', extract: getInfoByKey},
    {label: 'Type', valueType: D.valueType.STRING, key: 'type', extract: function(row){return mapMeetingType(row.type)}},
    {label: 'Unique meeting UUID', valueType: D.valueType.STRING, key: 'uuid', extract: getInfoByKey}
]

// Create the devices table with extracted properties
const meetingsProperties = meetingsExtractors.filter(function (row) {
    return row.label
})

const meetingsTable = D.createTable('List Meetings', meetingsProperties)

// Function to retrieve data based on a specific key
function getInfoByKey(row, key) {
    return row[key]
}

/**
 * Maps a meeting type code to its corresponding description.
 * @param {string} type The code representing the meeting type
 * @returns {string} The human-readable description of the meeting type, or 'N/A' if the code is not recognized
 */
function mapMeetingType(type) {
    const meetingTypeMap = {
        '1': 'Instant meeting',
        '2': 'Scheduled meeting',
        '3': 'Recurring meeting with no fixed time',
        '8': 'Recurring meeting with fixed time'
    }
    return meetingTypeMap[type] || 'N/A'
}

/**
 * Formats a UTC date string into a human-readable datetime string.
 * @param {string} dateString The UTC date string to be formatted
 * @returns {string} A formatted date string in the format 'YYYY-MM-DD HH:MM:SS'
 */
function formatDateTime(dateString) {
    const date = new Date(dateString)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds
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
 * @param {Object} d The deferred promise object
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
            console.error('Access token not found in response body')
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
    }
}

/**
 * Generates the HTTP configuration for the login API request.
 * @returns {Object} The HTTP configuration.
 */
function generateLoginConf() {
    return {
        url: '/oauth/token', 
        protocol: 'https', 
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + D._unsafe.buffer.from(clientId + ':' + clientSecret).toString('base64')
        }, 
        form: {
            'grant_type': 'account_credentials', 
            'account_id': accountId
        }, 
        rejectUnauthorized: false, 
        jar: true
    }
}

/**
 * Logs in to Zoom using the provided credentials and retrieves an access token
 * @returns {Promise} A promise that resolves when login is successful
 */
function login() {
    const d = D.q.defer()
    const config = generateLoginConf()
    zoomLogin.http.post(config, processLoginResponse(d))
    return d.promise
}

/**
 * Filters meetings based on the provided meetingIds
 * @param {Array} meetings List of meetings to filter
 * @returns {Array} Filtered list of meetings
 */
function filterMeetings(meetings) {
    return meetings.filter(function (meeting) {
        const associatedMeetings = meeting.id.toString()
        return (meetingId.length === 1 && meetingId[0].toLowerCase() === 'all') || meetingId.some(function (meetId) {
            return meetId.toLowerCase() === associatedMeetings.toLowerCase()
        })
    })
}

/**
 * Processes the response from the meeting list API request
 * Handles error checking, processes the meetings, and fetches additional pages if available
 * @param {Object} error The error returned by the HTTP request
 * @param {Object} response The HTTP response object
 * @param {Object} d The deferred promise object for handling async operations
 * @param {string} body The raw response body from the HTTP request
 */
function processMeetingsResponse(error, response, d, body) {
    checkHTTPError(error, response)
    if (error) {
        d.reject(error)
        return
    }
    const bodyAsJSON = JSON.parse(body)
    if (!Array.isArray(bodyAsJSON.meetings) || bodyAsJSON.meetings.length === 0) {
        console.error('No meetings found.')
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    let filteredMeetings = filterMeetings(bodyAsJSON.meetings)
    meetings = meetings.concat(extractdevices(filteredMeetings))
    if (bodyAsJSON.next_page_token) {
        pageToken = bodyAsJSON.next_page_token
        retrieveListMeetings()
            .then(function (meetings) {
                d.resolve(meetings)
            })
            .catch(function (err) {
                console.error('Error fetching next page of meetings:', err)
                d.reject(err)
            })
    } else {
        console.log('All meetings retrieved successfully.')
        d.resolve(meetings)
    }
}

// Generates the configuration for the meeting list API request
function generateConfig() {
    const url = '/v2/users/me/meetings?page_size=' + pageSize
    return {
        url: pageToken ? url + '&next_page_token=' + pageToken : url, 
        protocol: 'https', 
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }, 
        rejectUnauthorized: false, 
        jar: true
    }
}

/**
 * Makes the HTTP GET request to retrieve the list of meetings and returns a promise
 * @returns {Promise} A promise that resolves with the list of meetings
 */
function retrieveListMeetings() {
    const d = D.q.defer()
    const config = generateConfig()
    zoomResources.http.get(config, function (error, response, body) {
        processMeetingsResponse(error, response, d, body)
    })
    return d.promise
}

/**
 * Extracts the relevant information from a list of meetings
 * @param {Array} listMeetings The list of meetings to be processed
 * @returns {Array} A list of objects with extracted meeting information
 */
function extractdevices(listMeetings) {
    return listMeetings.map(function (meeting) {
        return meetingsExtractors.reduce(function (acc, item) {
            acc[item.key] = item.extract ? item.extract(meeting, item.key) : 'N/A'
            return acc
        }, {})
    })
}

/**
 * Inserts a new record into the meetings table for a given Zoom meeting
 * Maps the properties of the meeting to the corresponding table columns and inserts it
 * @param {Array} zoomMeetings The list of meetings retrieved from the Zoom API
 */
function insertRecord(zoomMeetings) {
    const recordValues = meetingsProperties.map(function (item) {
        return zoomMeetings[item.key] || 'N/A'
    })
    meetingsTable.insertRecord(zoomMeetings.id.toString(), recordValues)
}

/**
 * Populates the meetings table with records for all Zoom meetings
 * @param {Array} zoomMeetings The list of meetings to populate the table with
 */
function populateTable(zoomMeetings) {
    zoomMeetings.map(function (meeting) {
        insertRecord(meeting)
    })
    D.success(meetingsTable)
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveListMeetings)
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
 * @label Get Zoom Meetings
 * @documentation This procedure retrieves the list of Zoom meetings and populates the table with the meeting data.
 */
function get_status() {
    login()
        .then(retrieveListMeetings)
        .then(populateTable)
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}