/**
 * Domotz Custom Driver
 * Name: Zoom Rooms Live Meeting Audio Latency and Jitter
 * Description: This script retrieves audio related metrics, specifically latency and jitter, for live meetings in Zoom Rooms.
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 * 
 * requirements:
 * Granular Scopes: 
 *      - zoom_rooms:read:list_rooms:admin - Required to retrieve a list of Zoom Rooms
 *      - dashboard:read:zoomroom:admin - Needed to access dashboard-level metrics for Zoom Rooms
 *      - dashboard:read:meeting_participant_qos:admin - Allows access to Quality of Service (QoS) metrics for meeting participants
 * 
 * Creates Custom Driver table with the following columns:
 *      - Room Name: The name of the Zoom Room being monitored
 *      - Audio CRC In Jitter Avg: Average jitter for incoming audio packets in the CRC channel
 *      - Audio CRC In Latency Avg: Average latency for incoming audio packets in the CRC channel
 *      - Audio CRC Out Jitter Avg: Average jitter for outgoing audio packets in the CRC channel
 *      - Audio CRC Out Latency Avg: Average latency for outgoing audio packets in the CRC channel
 *      - Audio In Jitter Avg: Average jitter for incoming general audio packets
 *      - Audio In Latency Avg: Average latency for incoming general audio packets
 *      - Audio Out Jitter Avg: Average jitter for outgoing general audio packets
 *      - Audio Out Latency Avg: Average latency for outgoing general audio packets
 *      - Audio RWG In Jitter Avg: Average jitter for incoming audio packets in the RWG channel
 *      - Audio RWG In Latency Avg: Average latency for incoming audio packets in the RWG channel
 *      - Audio RWG Out Jitter Avg: Average jitter for outgoing audio packets in the RWG channel
 *      - Audio RWG Out Latency Avg: Average latency for outgoing audio packets in the RWG channel     
 * 
 **/

const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const roomIds = D.getParameter('roomIds')

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

let accessToken
let pageSize = 300

const meetingParticipantQosExtractors = [
    {"outputKey": "roomName", label: "Room Name"}, 
    {
        "key": "audio_device_from_crc",
        label: "Audio CRC In Jitter Avg",
        extract: calculateAverageByMetricName,
        metricName: "jitter",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_from_crc_jitter"
    }, 
    {
        "key": "audio_device_from_crc",
        label: "Audio CRC In Latency Avg",
        extract: calculateAverageByMetricName,
        metricName: "latency",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_from_crc_latency"
    }, 
    {
        "key": "audio_device_to_crc",
        label: "Audio CRC Out Jitter Avg",
        extract: calculateAverageByMetricName,
        metricName: "jitter",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_to_crc_jitter"
    }, 
    {
        "key": "audio_device_to_crc",
        label: "Audio CRC Out Latency Avg",
        extract: calculateAverageByMetricName,
        metricName: "latency",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_to_crc_latency"
    }, 
    {
        "key": "audio_input",
        label: "Audio In Jitter Avg",
        extract: calculateAverageByMetricName,
        metricName: "jitter",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_input_jitter"
    }, 
    {
        "key": "audio_input",
        label: "Audio In Latency Avg",
        extract: calculateAverageByMetricName,
        metricName: "latency",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_input_latency"
    }, 
    {
        "key": "audio_output",
        label: "Audio Out Jitter Avg",
        extract: calculateAverageByMetricName,
        metricName: "jitter",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_output_jitter"
    }, 
    {
        "key": "audio_output",
        label: "Audio Out Latency Avg",
        extract: calculateAverageByMetricName,
        metricName: "latency",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_output_latency"
    }, 
    {
        "key": "audio_device_from_rwg",
        label: "Audio RWG In Jitter Avg",
        extract: calculateAverageByMetricName,
        metricName: "jitter",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_from_rwg_jitter"
    }, 
    {
        "key": "audio_device_from_rwg",
        label: "Audio RWG In Latency Avg",
        extract: calculateAverageByMetricName,
        metricName: "latency",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_from_rwg_latency"
    }, 
    {
        "key": "audio_device_to_rwg",
        label: "Audio RWG Out Jitter Avg",
        extract: calculateAverageByMetricName,
        metricName: "jitter",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_to_rwg_jitter"
    }, 
    {
        "key": "audio_device_to_rwg",
        label: "Audio RWG Out Latency Avg",
        extract: calculateAverageByMetricName,
        metricName: "latency",
        unit: "ms",
        valueType: D.valueType.NUMBER,
        "outputKey": "audio_device_to_rwg_latency"
    }
]

const meetingParticipantQosProperties = meetingParticipantQosExtractors.filter(function (row) {
    return row.label
})

const outputTable = D.createTable("Rooms Live Meeting Audio Latency and Jitter", meetingParticipantQosProperties)

/**
 * Extracts the numeric portion from a string and converts it to a floating-point number.
 * @param {string} value - The input string potentially containing a numeric value.
 * @returns {number} - The extracted numeric value as a float, or 0 if no valid number is found.
 */
function extractNumericValue(value) {
    if (value) {
        const match = value.match(/[\d.]+/)
        return match ? parseFloat(match[0]) : 0
    }
    return 0
}

/**
 * Calculates the average value of a specified metric for a list of participants.
 * @param {Array<Object>} participants - The list of participants, where each participant contains user QoS data.
 * @param {string} qosType - The type of QoS (Quality of Service) to analyze.
 * @param {string} metricName - The name of the metric to calculate the average for.
 * @returns {number|undefined} The average value of the specified metric, or `undefined` if the input is invalid.
 */
function calculateAverageByMetricName(participants, qosType, metricName) {
    if (participants !== undefined && participants.length) {
        const sum = participants.reduce(function (acc, participant) {
            acc += extractNumericValue(participant.user_qos[0][qosType][metricName])
            return acc
        }, 0)
        return sum === 0 ? 0 : (sum / participants.length)
    }
    return undefined
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
    } else if (response.statusCode === 400) {
        D.failure(response.body)
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
 * Generates the configuration object for the API request.
 * @returns {Object} - The configuration object containing the API endpoint, headers, and options.
 */
function generateConfig(url) {
    return {
        url: url,
        protocol: "https",
        headers: {
            "Authorization": "Bearer " + accessToken
        }, 
        rejectUnauthorized: false, 
        jar: true
    }
}

/**
 * Constructs the pagination URL for fetching Zoom Rooms with page token and page size
 * @returns {string} The pagination URL for Zoom API request
 */
function getPaginationUrl(url, pageToken) {
    if (pageToken) {
        url += "&next_page_token=" + pageToken
    }
    return url
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
 * Inserts a record into the output table.
 * @param roomId
 * @param {Object} roomsQosAverage - The object to insert into the output table.
 */
function insertRecord(roomId, roomsQosAverage) {
    const recordValues = meetingParticipantQosProperties.map(function (item) {
        return roomsQosAverage[item.outputKey] || 'N/A'
    })
    outputTable.insertRecord(sanitize(roomId.toString()), recordValues)
}

/**
 * Populates all Meeting Participants Latency and Jitter into the output table.
 */
function populateTable(roomsQosAverage) {
    roomsQosAverage.forEach(function (roomsQos) {
        const roomId = roomsQos.roomId
        delete roomsQos.roomId
        insertRecord(roomId, roomsQos)
    })
}

/**
 * Pauses execution for a specified duration.
 * @param {number} ms - The number of milliseconds to wait.
 * @returns {Promise} A promise that resolves after the specified duration.
 */
function wait(ms) {
    const d = D.q.defer()
    setTimeout(function() {
        d.resolve()
    }, ms)
    return d.promise
}

/**
 * Retrieves Azure Virtual Machine Scale Sets for the subscription.
 * @returns {Promise} A promise that resolves with the Virtual Machine Scale Set data.
 */
function callGetHttpRequest(extractDetailsFromBody, checkBodyJsonIsNotEmpty, endpoint) {
    const d = D.q.defer()
    let output = []
    let pageToken = null
    let countCall = 0
    function fetchData() {
        const url = getPaginationUrl(endpoint, pageToken)
        const config = generateConfig(url)
        zoomResources.http.get(config, function (error, response, body) {
            countCall++
            if (countCall <= 3) {
                if (response.statusCode === 429) {
                    console.log("Rate limit hit, waiting for 1 seconds...")
                    wait(1000).then(function () {
                        fetchData()
                    })
                    return
                }
                checkHTTPError(error, response)
                if (error) {
                    d.reject(error)
                    return
                }
                const bodyAsJSON = JSON.parse(body)
                if (checkBodyJsonIsNotEmpty(bodyAsJSON)) {
                    D.failure(D.errorType.GENERIC_ERROR)
                }
                const extractedDetails = extractDetailsFromBody(bodyAsJSON)
                pageToken = bodyAsJSON.next_page_token

                if (pageToken === undefined) {
                    output = extractedDetails
                }else{
                    if (Array.isArray(extractedDetails)) {
                        output = output.concat(extractedDetails)
                    } else {
                        if (typeof extractedDetails === "object") {
                            output.push(extractedDetails)
                        }else{
                            D.failure(D.errorType.GENERIC_ERROR)
                        }
                    }
                }
                if (pageToken) {
                    fetchData()
                } else {
                    console.log("All data retrieved successfully from: " + endpoint)
                    d.resolve(output)
                }
            } else {
                console.error("This endpoint: " + url + " is not reachable for 3 times.")
                D.failure(D.errorType.GENERIC_ERROR)
            }
        })
    }
    fetchData()
    return d.promise
}

/**
 * Calculates the QoS average for each room.
 * @param {Array<Object>} roomParticipantQos - The list of room QoS data to process.
 * @returns {Array<Object>} The extracted metrics QoS for each room.
 */
function calculateQosAverageForEachRoom(roomParticipantQos) {
    return roomParticipantQos.map(function (roomQos) {
        return extractMetricsQos(roomQos)
    })
}

/**
 * Retrieves Zoom Rooms by making an HTTP GET request.
 * Constructs the URL, calls the HTTP request, and processes the response.
 * @returns {Promise} A promise that resolves when the Zoom Rooms are retrieved and processed.
 */
function retrieveZoomRooms() {
    let url = "/v2/rooms?page_size=" + pageSize
    return callGetHttpRequest(extractZoomRoomsId, checkRoomsBodyJsonIsNotEmpty, url)
}

/**
 * Retrieve All Meeting Participants Qos.
 * @returns {promise}
 */
function retrieveAllMeetingQos(roomDetails) {
    const promises = roomDetails.map(function (room) {
        return retrieveMeetingParticipantQos(room)
            .then(function (responses) {
                return processMeetingParticipantQos(responses, room)
            })
    })
    return D.q.all(promises)
}

/**
 * Retrieve Meeting Participants Qos.
 * @returns {Promise}
 */
function retrieveMeetingParticipantQos(room) {
    const d = D.q.defer()
    const meetingId = room.meetingId
    if (meetingId) {
        const url = "/v2/metrics/meetings/" + meetingId + "/participants/qos?page_size=" + pageSize
        return callGetHttpRequest(extractMeetingParticipantQos, checkParticipantQosBodyJsonIsNotEmpty, url)
    } else {
        console.log("There is no live meeting related to this room " + room.roomName)
        d.resolve()
    }
    return d.promise
}

/**
 * Retrieves room details by making an HTTP GET request.
 * @param {string} roomId - The ID of the room to retrieve details for.
 * @returns {Promise} A promise that resolves with the room details.
 */
function retrieveRoomDetails(roomId) {
    const url = '/v2/metrics/zoomrooms/' + roomId
    return callGetHttpRequest(extractRoomDetails, checkRoomDetailsBodyJsonIsNotEmpty, url)
}

/**
 * Retrieves live meeting details for all Zoom rooms.
 * @param {Array<string>} zoomRooms - The list of Zoom room IDs to retrieve live meeting details for.
 * @returns {Promise} A promise that resolves when all room details have been retrieved.
 */
function retrieveAllRoomsLiveMeetingDetails(zoomRooms) {
    const promises = zoomRooms.map(function (roomId) {
        return retrieveRoomDetails(roomId)
    })
    return D.q.all(promises)
}

/**
 * Checks if the participants QoS body JSON is not empty.
 * Logs an error if the participants array is empty or not an array.
 * @param {Array<Object>} participants - The list of participants to validate.
 */
function checkParticipantQosBodyJsonIsNotEmpty(participants) {
    if (!Array.isArray(participants) || participants.length === 0) {
        console.error("No Meeting Participants QoS found.")
    }
}

/**
 * Checks if the rooms body JSON is not empty.
 * Logs an error and returns `true` if the rooms array is empty or invalid.
 * @param {Object} bodyAsJSON - The JSON object containing the rooms data.
 * @returns {boolean} `true` if the rooms array is empty or invalid, otherwise `false`.
 */
function checkRoomsBodyJsonIsNotEmpty(bodyAsJSON) {
    if (!Array.isArray(bodyAsJSON.rooms) || bodyAsJSON.rooms.length === 0) {
        console.error("No rooms found.")
        return true
    }
    return false
}

/**
 * Checks if the participants array is not empty.
 * Logs an error if the participants array is empty or not an array.
 * @param {Array<Object>} bodyAsJSON - The array of meeting participants.
 */
function checkRoomDetailsBodyJsonIsNotEmpty(bodyAsJSON) {
    if (!(bodyAsJSON.id && bodyAsJSON.room_name && bodyAsJSON.live_meeting && bodyAsJSON.live_meeting)) {
        console.error("No Room details found.")
    }
}

/**
 * Extracts relevant information from a Zoom room response
 * @param {Object} roomQos The raw Zoom room data
 * @returns {Object} A simplified object with only necessary fields
 */
function extractMetricsQos(roomQos) {
    return meetingParticipantQosProperties.reduce(function (acc, item) {
        if (item.extract) {
            acc[item.outputKey] = item.extract(roomQos.participants, item.key, item.metricName)
        }
        return acc
    }, {roomId: roomQos.roomId, roomName: roomQos.roomName})
}

/**
 * Extracts relevant information from a Zoom room response
 * @returns {Object} A simplified object with only necessary fields
 * @param bodyAsJSON
 */
function extractZoomRoomsId(bodyAsJSON) {
    let selectedRoomIds = []
    bodyAsJSON.rooms.forEach(function (zoomRoom) {
        const id = zoomRoom.id
        if ((roomIds.length === 1 && roomIds[0].toLowerCase() === 'all') || roomIds.includes(id)) {
            selectedRoomIds.push(id)
        }
    })
    return selectedRoomIds
}

/**
 * Extracts room details from the JSON body.
 * @param {Object} bodyAsJSON - The JSON object containing room data.
 * @returns {Object} The extracted room details including ID, room name, and meeting ID.
 */
function extractRoomDetails(bodyAsJSON) {
    return ({id: bodyAsJSON.id, roomName: bodyAsJSON.room_name, meetingId: bodyAsJSON.live_meeting.id ? bodyAsJSON.live_meeting.id : null })
}

/**
 * Extracts meeting participant QoS data from the JSON body.
 * @param {Object} bodyAsJSON - The JSON object containing QoS data.
 * @returns {Object} The same JSON object.
 */
function extractMeetingParticipantQos(bodyAsJSON) {
    return bodyAsJSON
}

/**
 * Merges participants from multiple responses into a single object with room details.
 * @param {Array<Object>} responses - The responses containing participant data.
 * @param {Object} room - The room object with room ID and name.
 * @returns {Object} The merged data with room details and participants.
 */
function processMeetingParticipantQos(responses, room) {
    return responses.reduce(function (acc, response) {
        acc.participants = acc.participants.concat(response.participants)
        return acc
    }, {roomId: room.id, roomName: room.roomName, participants: []})
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveZoomRooms)
        .then(retrieveAllRoomsLiveMeetingDetails)
        .then(retrieveAllMeetingQos)
        .then(calculateQosAverageForEachRoom)
        .then(D.success)
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Zoom Meeting Participants QoS
 * @documentation This procedure retrieves the list of Zoom Meeting Participants QoS, filters based on roomId, and populates a table with room details
 */
function get_status() {
    login()
        .then(retrieveZoomRooms)
        .then(retrieveAllRoomsLiveMeetingDetails)
        .then(retrieveAllMeetingQos)
        .then(calculateQosAverageForEachRoom)
        .then(function (roomsQosAverage) {
            populateTable(roomsQosAverage)
            D.success(outputTable)
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}