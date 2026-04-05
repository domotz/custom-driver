/**
 * Domotz Custom Driver
 * Name: Microsoft Teams Rooms - Ongoing Meeting Participants
 * Description: This script monitor the number of participants in ongoing Microsoft Teams meetings for each room.
 * It extracts detailed information about the attendees, including the count of required and optional participants, as well as their statuses (Accepted, Tentatively Accepted, and No Status)
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
 *    - Total Attendees: The total number of attendees in the ongoing meeting
 *    - Required Attendees: The number of required attendees
 *    - Optional Attendees: The number of optional attendees
 *    - Resource Attendees: The number of resource attendees
 *    - Accepted: The number of attendees who accepted the invitation
 *    - Tentatively Accepted: The number of attendees who tentatively accepted the invitation
 *    - Declined: The number of attendees who declined the invitation
 *    - Absent: The number of attendees who have not responded or are absent
 **/

const tenantId = D.getParameter('tenantId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')

const microsoftLoginService = D.createExternalDevice('login.microsoftonline.com')
const teamsManagementService = D.createExternalDevice('graph.microsoft.com')

let accessToken
let roomsTable
let email

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

// Extractors for ongoing meeting information
const ongoingMeetingInfoExtractors = [{
    label: 'Total Attendees', valueType: D.valueType.STRING, key: 'attendees', extract: function (meeting) {
        return countAttendees(meeting.attendees).total
    }
}, {
    label: 'Required Attendees', valueType: D.valueType.STRING, key: 'required', extract: function (meeting) {
        return countAttendees(meeting.attendees).required
    }
}, {
    label: 'Optional Attendees', valueType: D.valueType.STRING, key: 'optional', extract: function (meeting) {
        return countAttendees(meeting.attendees).optional
    }
}, {
    label: 'Resource Attendees', valueType: D.valueType.STRING, key: 'resource', extract: function (meeting) {
        return countAttendees(meeting.attendees).resource
    }
}, {
    label: 'Accepted', valueType: D.valueType.STRING, key: 'accepted', extract: function (meeting) {
        return countAttendees(meeting.attendees).accepted
    }
}, {
    label: 'Tentatively Accepted', valueType: D.valueType.STRING, key: 'tentativelyAccepted', extract: function (meeting) {
        return countAttendees(meeting.attendees).tentativelyAccepted
    }
}, {
    label: 'Declined', valueType: D.valueType.STRING, key: 'declined', extract: function (meeting) {
        return countAttendees(meeting.attendees).declined
    }
}, {
    label: 'Absent', valueType: D.valueType.STRING, key: 'none', extract: function (meeting) {
        return countAttendees(meeting.attendees).none
    }
}]

/**
 * Combines room and availability extractors into a single list.
 * @returns {Array} The combined list of room properties and availability properties.
 */
function generateRoomProperties() {
    return roomInfoExtractors.concat(ongoingMeetingInfoExtractors).filter(function (result) {
        return result.label
    })
}

/**
 * Creates a table to display the Microsoft Teams Rooms meeting participants data.
 * @param {Array} roomProperties - The properties to define the structure of the table.
 */
function createRoomsTable(roomProperties) {
    tableHeaders = roomProperties.map(function(item) {return { label: item.label }});

    roomsTable = D.createTable('Microsoft Teams Rooms Meeting Participants', tableHeaders)
}

const roomProperties= generateRoomProperties() // Generate the list of properties to display
createRoomsTable(roomProperties) // Create the table with the defined properties


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
 * Counts the attendees of a meeting based on their type and status.
 * @param {Array} attendees - The list of attendees for a meeting.
 * @returns {Object} An object with counts for different attendee types and statuses.
 */
function countAttendees(attendees) {
    var counts = {
        total: attendees.length,
        required: 0,
        optional: 0,
        resource: 0,
        accepted: 0,
        declined: 0,
        tentativelyAccepted: 0,
        none: 0
    }
    attendees.forEach(function(attendee) {
        var type = attendee.type
        var status = attendee.status
        var response = status.response
        if (counts[type] !== undefined) counts[type]++
        if (counts[response] !== undefined) counts[response]++
    })
    return counts
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
 * Processes the response from the API call that retrieves ongoing meetings.
 * @param {Object} d - The deferred object to resolve or reject the operation.
 * @returns {Function} A callback function that processes the API response.
 */
function processOngoingMeetingsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (!bodyAsJSON.value) {
            console.error('No calendar data returned, cannot check for ongoing Microsoft Teams meetings')
            D.failure(D.errorType.GENERIC_ERROR)
        }

        let meetings = bodyAsJSON.value.map(function(room) {
            let ongoingMeetings = extractOngoingMeetingsInfo(room)
            if (!ongoingMeetings || ongoingMeetings.length === 0) {
                console.info('There are no ongoing meetings at the moment in room:', email)
            }
            return ongoingMeetings
        })

        d.resolve(meetings)
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
 * Extracts ongoing meeting information from a list of meetings.
 * @param {Array} meetings - The list of ongoing meetings.
 * @returns {Array} A list of extracted information for each meeting.
 */
function extractOngoingMeetingsInfo(meetings) {
    return extractInfo(meetings, 'id', ongoingMeetingInfoExtractors)
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
 * Retrieves ongoing meetings for the rooms.
 * @param {Array} meetings - The list of ongoing meetings.
 * @returns {Promise} A promise that resolves when all ongoing meetings have been retrieved.
 */
function retrieveOngoingMeetings(meetings) {
    const promises = meetings.map(function (meeting) {
        email = meeting.emailAddress
        const now = new Date()
        const end = new Date(now.getTime() + 30 * 60000)
        const d = D.q.defer()
        const config = {
            url: '/v1.0/users/' + email + '/calendarView?startDateTime=' + toISOStringNoMs(now) + '&endDateTime=' + toISOStringNoMs(end),
            protocol: 'https',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false,
            jar: true
        }
        teamsManagementService.http.get(config, processOngoingMeetingsResponse(d))
        return d.promise
    })
    return D.q.all(promises)
}

/**
 * Inserts a single room record into the table.
 * @param {Object} room - Room object containing various properties.
 */
function insertRecord(room) {
    const roomData = room['0'] || {}
    const recordValues = roomProperties.map(function (item) {
        return room[item.key] || 'N/A' && roomData[item.key] || 'N/A'
    })
    roomsTable.insertRecord(room.id, recordValues)
}

/**
 * Populates the table with the extracted room information.
 * @param {Array} roomsInfoList - The list of rooms and their details.
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
            return retrieveOngoingMeetings(rooms)
                .then(function() { D.success() })
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Teams Rooms Meeting Participants
 * @documentation  This procedure retrieves and displays the number of participants in ongoing Microsoft Teams meetings for each room.
 */
function get_status() {
    login()
        .then(retrieveListRooms)
        .then(function(rooms) {
            return retrieveOngoingMeetings(rooms)
                .then(function(ongoingMeetings) {
                    const mergedRooms = rooms.map(function (room, index) {
                        return Object.assign({}, room, ongoingMeetings[index])
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