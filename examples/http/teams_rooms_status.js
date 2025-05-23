/**
 * Domotz Custom Driver
 * Name: Microsoft Teams Rooms status
 * Description: This script monitor the current status of Microsoft Teams Rooms, determining if the rooms are busy or free.
 *
 * Tested on Microsoft Graph API version 1.0
 *
 * Communication protocol is HTTPS
 *
 * requirements:
 *    Grant permission to extract the list of room: Place.Read.All
 *    Grant permission to extract to calendar data: Calendars.ReadBasic
 *
 * Creates a custom driver with the following columns:
 *    - Email Address: The unique email address associated with the Microsoft Teams Room
 *    - Room Name: The human-readable name of the Microsoft Teams Room
 *    - Status: The current status of the Microsoft Teams Room
 *
 **/

const tenantId = D.getParameter('tenantId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')

const microsoftLoginService = D.createExternalDevice('login.microsoftonline.com')
const teamsManagementService = D.createExternalDevice('graph.microsoft.com')

let accessToken
let roomsTable

// Extractors for Room Information
const roomInfoExtractors = [{
    key: 'id', extract: function (room) {
        return sanitize(room.id)
    }
}, {
    label: 'Email Address', valueType: D.valueType.STRING, key: 'emailAddress', extract: function (room) {
        return extractByKey(room, 'emailAddress')
    }
}, {
    label: 'Room Name', valueType: D.valueType.STRING, key: 'displayName', extract: function (room) {
        return extractByKey(room, 'displayName')
    }
}]

// Extractors for Room Availability Information
const availabilityRoomInfoExtractors = [
    {
        label: 'Status', valueType: D.valueType.STRING, key: 'availabilityView', extract: function (room) {
            return mapRoomStatus(extractByKey(room, 'availabilityView'))
        }
    }
]

/**
 * Combines room and availability extractors into a single list.
 * @returns {Array} The combined list of room properties and availability properties.
 */
function generateRoomProperties() {
    return roomInfoExtractors.concat(availabilityRoomInfoExtractors).filter(function (result) {
        return result.label
    })
}

/**
 * Creates a table in Domotz to display the room's status.
 * @param {Array} roomProperties - The properties of the rooms to be displayed in the table.
 */
function createRoomsTable(roomProperties) {
    roomsTable = D.createTable('Microsoft Teams Rooms status', roomProperties)
}

const roomProperties= generateRoomProperties()
createRoomsTable(roomProperties)

/**
 * Extracts a specific property from the room object by key.
 * @param {Object} room - The room object.
 * @param {string} key - The key whose value is to be extracted.
 * @returns {string} The value of the extracted key, or 'N/A' if not found.
 */
function extractByKey(room, key) {
    return room && room[key] ? room[key] : 'N/A'
}

/**
 * Maps the room status code to a human-readable format.
 * @param {string} roomStatus - The raw status code from Microsoft Graph API.
 * @returns {string} The human-readable room status.
 */
function mapRoomStatus(roomStatus) {
    const roomStatusMap = {
        '0': 'Free',
        '1': 'Tentative',
        '2': 'Busy',
        '3': 'Out of office',
    }
    return roomStatusMap[roomStatus]
}

/**
 * Sanitizes the output by removing reserved words and formatting it.
 * @param {string} output - The string to be sanitized.
 * @returns {string} The sanitized string.
 */
function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures.
 * @param {Object} error - The error object returned from the HTTP request.
 * @param {Object} response - The HTTP response object.
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
 * Processes the login response from the Azure API and extracts the access token.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
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
 * Processes the response from the request to retrieve rooms from Microsoft Graph.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processRoomsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (!bodyAsJSON.value) {
            console.error('No Rooms found in the response')
            D.failure(D.errorType.GENERIC_ERROR)
        }
        let listRooms = bodyAsJSON.value.map(extractRoomsInfo)
        if (!listRooms.length) {
            console.info('There is no Rooms')
        }
        d.resolve(listRooms)
    }
}

/**
 * Processes the response from the request to retrieve room availability from Microsoft Graph.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processRoomAvailabilityResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (!bodyAsJSON.value) {
            console.error('No Schedule data found in the response')
            D.failure(D.errorType.GENERIC_ERROR)
        }
        let availabilityRooms = bodyAsJSON.value.map(extractAvailabilityRoomsInfo)
        if (!availabilityRooms.length) {
            console.info('There is no schedule info')
        }
        d.resolve(availabilityRooms)
    }
}

/**
 * Logs in to the microsoft cloud service using OAuth2 credentials.
 * @returns {Promise} A promise that resolves upon successful login.
 */
function login() {
    const d = D.q.defer()
    const config = {
        url: '/' + tenantId + '/oauth2/v2.0/token', protocol: 'https', headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        }, form: {
            grant_type: 'client_credentials',
            client_id: clientId,
            client_secret: clientSecret,
            scope: 'https://graph.microsoft.com/.default'
        }, rejectUnauthorized: false, jar: true
    }
    microsoftLoginService.http.post(config, processLoginResponse(d))
    return d.promise
}

/**
 * Extracts the specified room information based on the provided extractors.
 * @param {Object} room - The room object.
 * @param {string} idKey - The key to identify the room (e.g., 'id').
 * @param {Array} extractors - The list of extractors to apply to the room.
 * @returns {Object} The extracted room information.
 */
function extractInfo(room, idKey, extractors) {
    if (!room || !room[idKey]) return null
    const extractedInfo = {}
    extractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(room)
    })
    return extractedInfo
}

/**
 * Extracts the basic information from a room object.
 * @param {Object} room - The room object.
 * @returns {Object} The extracted room information.
 */
function extractRoomsInfo(room) {
    return extractInfo(room, 'id', roomInfoExtractors)
}

/**
 * Extracts the availability information from a room object.
 * @param {Object} room - The room object.
 * @returns {Object} The extracted availability information.
 */
function extractAvailabilityRoomsInfo(room) {
    return extractInfo(room, 'scheduleId', availabilityRoomInfoExtractors)
}

/**
 * Retrieves a list of all rooms from the Microsoft Graph API.
 * @returns {Promise} A promise that resolves with the list of rooms.
 */
function retrieveListRooms() {
    const d = D.q.defer()
    const config = {
        url:  '/v1.0/places/microsoft.graph.room',
        protocol: 'https',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
        },
        rejectUnauthorized: false,
        jar: true
    }
    teamsManagementService.http.get(config, processRoomsResponse(d))
    return d.promise
}

/**
 * Converts a date to an ISO string format without milliseconds.
 * @param {Date} date - The date to be converted.
 * @returns {string} The ISO string representation of the date.
 */
function toISOStringNoMs(date) {
    return date.toISOString().split('.')[0]
}

/**
 * Checks the availability of rooms using the Microsoft Graph API.
 * @param {Array} rooms - List of room objects containing email addresses.
 * @returns {Promise} A promise that resolves with the availability data of the rooms.
 */
function checkRoomAvailability(rooms) {
    const d = D.q.defer()
    const schedules = rooms.map(function (room) {
        return room.emailAddress
    })
    const now = new Date()
    const end = new Date(now.getTime() + 30 * 60000)
    const postData = {
        schedules: schedules, startTime: {
            dateTime: toISOStringNoMs(now), timeZone: 'UTC'
        }, endTime: {
            dateTime: toISOStringNoMs(end), timeZone: 'UTC'
        }
    }
    const config = {
        url: '/v1.0/users/' + schedules[0] + '/calendar/getSchedule',
        protocol: 'https',
        headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(postData),
        rejectUnauthorized: false,
        jar: true
    }
    teamsManagementService.http.post(config, processRoomAvailabilityResponse(d))
    return d.promise
}

/**
 * Inserts a single room record into the table.
 * @param {Object} room - Room object containing various properties.
 */
function insertRecord(room) {
    const recordValues = roomProperties.map(function (item) {
        return room[item.key] || 'N/A'
    })
    roomsTable.insertRecord(room.id, recordValues)
}

/**
 * Populates the table with a list of room data.
 * @param {Array} roomsInfoList - List of room objects.
 */
function populateTable(roomsInfoList) {
    roomsInfoList.map(insertRecord)
}

/**
 * @remote_procedure
 * @label Validate Teams connection
 * @documentation This procedure is used to validate connectivity and permission by ensuring Teams Rooms data are accessible via the Microsoft Graph API.
 */
function validate() {
    login()
        .then(retrieveListRooms)
        .then(function(rooms) {
            return checkRoomAvailability(rooms)
                .then(function() { D.success() })
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Teams Rooms Status
 * @documentation This procedure is used to retrieve and display the availability status of Microsoft Teams Rooms.
 */
function get_status() {
    login()
        .then(retrieveListRooms)
        .then(function(rooms) {
            return checkRoomAvailability(rooms)
                .then(function(availability) {
                    const mergedRooms = rooms.map(function (room, index) {
                        return Object.assign({}, room, availability[index])
                    })
                    populateTable(mergedRooms)
                    D.success(roomsTable)
                })
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}