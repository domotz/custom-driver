/**
 * Domotz Custom Driver
 * Name: Meeting Participants Latency and Jitter
 * Description: This script retrieves information about Zoom Meeting Participants Latency and Jitter
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 * Granular Scopes: dashboard:read:list_meeting_participants_qos:admin
 *
 * Creates Custom Driver table with the following columns:
 *    - User Name
 *    - Email
 *    - Type
 *    - Minimum Bitrate
 *    - Average Bitrate
 *    - Maximum Bitrate
 *    - Minimum Latency
 *    - Average Latency
 *    - Maximum Latency
 *    - Minimum Jitter
 *    - Average Jitter
 *    - Maximum Jitter
 *    - Minimum Packet Loss
 *    - Average Packet Loss
 *    - Maximum Packet Loss
 *    - Resolution
 *    - Minimum Frame Rate
 *    - Average Frame Rate
 *    - Maximum Frame Rate
 *    - Zoom Minimum CPU Usage
 *    - Zoom Average CPU Usage
 *    - Zoom Maximum CPU Usage
 *    - System Maximum CPU Usage
 *
 **/

const accountId = D.getParameter("accountId")
const clientId = D.getParameter("clientId")
const clientSecret = D.getParameter("clientSecret")

const meetingId = D.getParameter('meetingId')
const participantIds = D.getParameter('participantIds')

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

let accessToken
let pageToken
let meetingParticipantQos = []
let pageSize = 30
let id = 1

const meetingParticipantExtractors = [
    {label: 'Device', valueType: D.valueType.STRING, key: 'device', extract: getInfoByKey},
    {label: 'Client', valueType: D.valueType.STRING, key: 'client', extract: getInfoByKey},
    {label: 'Domain', valueType: D.valueType.STRING, key: 'domain', extract: getInfoByKey},
    {label: 'Hard Disk ID', valueType: D.valueType.STRING, key: 'harddisk_id', extract: getInfoByKey},
    {label: 'Internal IP Addresses', valueType: D.valueType.ARRAY, key: 'internal_ip_addresses', extract: getJoinedListInfoByKey},
    {label: 'IP Address', valueType: D.valueType.STRING, key: 'ip_address', extract: getInfoByKey},
    {label: 'Join Time', valueType: D.valueType.DATETIME, key: 'join_time', extract: getInfoByKey},
    {label: 'Leave Time', valueType: D.valueType.DATETIME, key: 'leave_time', extract: getInfoByKey},
    {label: 'Location', valueType: D.valueType.STRING, key: 'location', extract: getInfoByKey},
    {label: 'MAC Address', valueType: D.valueType.STRING, key: 'mac_addr', extract: getInfoByKey},
    {label: 'PC Name', valueType: D.valueType.STRING, key: 'pc_name', extract: getInfoByKey},
    {label: 'User ID', valueType: D.valueType.STRING, key: 'user_id', extract: getInfoByKey},
    {label: 'User Name', valueType: D.valueType.STRING, key: 'user_name', extract: getInfoByKey}
];

const otherProprieties = [
    {valueType: D.valueType.STRING, key: 'id'},
    {label: 'QoS Type', valueType: D.valueType.STRING, key: 'type'}
]

const qosExtractors = [
    {label: 'Average Packet Loss', valueType: D.valueType.NUMBER, unit: '%', key: 'avg_loss', extract: getQosDetailByKey},
    {label: 'Bitrate', valueType: D.valueType.NUMBER, unit: 'kbps', key: 'bitrate', extract: getQosDetailByKey},
    {label: 'Jitter', valueType: D.valueType.NUMBER, unit: 'ms', key: 'jitter', extract: getQosDetailByKey},
    {label: 'Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'latency', extract: getQosDetailByKey},
    {label: 'Maximum Packet Loss', valueType: D.valueType.NUMBER, unit: '%', key: 'max_loss', extract: getQosDetailByKey},
    {label: 'Frame Rate', valueType: D.valueType.NUMBER, unit: 'fps', key: 'frame_rate', extract: getQosDetailByKey},
    {label: 'Resolution', valueType: D.valueType.STRING, key: 'resolution', extract: getQosDetailByKey}
];

const selectedTypesToRetrieve = [
    {"key": "as_device_from_crc", "label": "as device from crc"},
    {"key": "as_device_to_crc", "label": "as device to crc"},
    {"key": "as_input", "label": "as input"},
    {"key": "as_output", "label": "as output"},
    {"key": "audio_device_from_crc", "label": "audio device from crc"},
    {"key": "audio_device_to_crc", "label": "audio device to crc"},
    {"key": "audio_input", "label": "audio input"},
    {"key": "audio_output", "label": "audio output"},
    {"key": "video_device_from_crc", "label": "video device from crc"},
    {"key": "video_device_to_crc", "label": "video device to crc"},
    {"key": "video_input", "label": "video input"},
    {"key": "video_output", "label": "video output"},
    {"key": "as_device_from_rwg", "label": "as device from rwg"},
    {"key": "as_device_to_rwg", "label": "as device to rwg"},
    {"key": "audio_device_from_rwg", "label": "audio device from rwg"},
    {"key": "audio_device_to_rwg", "label": "audio device to rwg"},
    {"key": "video_device_from_rwg", "label": "video device from rwg"},
    {"key": "video_device_to_rwg", "label": "video device to rwg"}
]

const meetingParticipantQosExtractors = otherProprieties.concat(meetingParticipantExtractors).concat(qosExtractors)
const meetingParticipantQosProperties = meetingParticipantQosExtractors.filter(function (row) {
    return row.label
})

const meetingParticipantQosTable = D.createTable("Meeting Participants Latency and Jitter", meetingParticipantQosProperties)

/**
 * Retrieves the value of a specific key from an object.
 * @param {Object} row
 * @param {string} key
 */
function getInfoByKey(row, key) {
    return row[key] || "N/A"
}

/**
 * Retrieves a list of values of a specific key from an object and join it by ', '.
 * @param {Object} row
 * @param {string} key
 */
function getJoinedListInfoByKey(row, key) {
    return row[key].join(', ')
}

/**
 * Retrieves the value of a specific key from the details property of an object.
 * @param {Object} row
 * @param {string} key
 * @param valueType
 */
function getQosDetailByKey(row, key, valueType) {
    if (row[key]) {
        if (valueType === D.valueType.NUMBER) {
            const match = row[key].match(/[\d.]+/)
            return match ? parseFloat(match[0]) : "N/A";
        }
        return row[key] || "N/A"
    }
    return "N/A"
}

/**
 * GenerateId from an object concatenated by an index.
 * @param {Object} row
 * @param index
 */
function generateId(row, index) {
    return row["id"] + "-" + (index + 1)
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
 * Processes the Meeting Participant QoS data and handles pagination if necessary.
 * @param {Error|null} error - The error object, if any, from the API response.
 * @param {Object} response - The HTTP response object.
 * @param {Object} d - A deferred object for resolving or rejecting the promise.
 * @param {string} body - The raw response body as a JSON string.
 */
function processMeetingParticipantQos(error, response, d, body) {
    checkHTTPError(error, response)
    if (error) {
        d.reject(error)
        return
    }
    const bodyAsJSON = JSON.parse(body)
    if (!Array.isArray(bodyAsJSON.participants) || bodyAsJSON.participants.length === 0) {
        console.error("No Meeting Participants QoS found.")
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    meetingParticipantQos = meetingParticipantQos.concat(extractMeetingParticipantQos(bodyAsJSON))
    if (bodyAsJSON.next_page_token) {
        pageToken = bodyAsJSON.next_page_token
        retrieveMeetingParticipantQos()
            .then(function (Qos) {
                d.resolve(Qos)
            })
            .catch(function (err) {
                console.error("Error fetching next page of Meeting Participants QoS:", err)
                d.reject(err)
            })
    } else {
        console.log("All Meeting Participants QoS retrieved successfully.")
        d.resolve(meetingParticipantQos)
    }
}

/**
 * Generates the configuration object for the API request.
 * @returns {Object} - The configuration object containing the API endpoint, headers, and options.
 */
function generateConfig() {
    const url = "/v2/metrics/meetings/" + meetingId + "/participants/qos_summary?page_size=" + pageSize
    return {
        url: pageToken ? url + "&next_page_token=" + pageToken : url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieve Meeting Participants Qos.
 * @returns {promise}
 */
function retrieveMeetingParticipantQos() {
    const d = D.q.defer()
    const config = generateConfig();
    zoomResources.http.get(config, function (error, response, body) {
        processMeetingParticipantQos(error, response, d, body);
    })
    return d.promise
}

/**
 * Extracts relevant information from a Zoom room response
 * @param {Object} meetingParticipantQos The raw Zoom room data
 * @returns {Object} A simplified object with only necessary fields
 */
function extractMeetingParticipantQos(meetingParticipantQos) {
    return meetingParticipantQos.participants.reduce(function (participantsAcc, participant) {
        const participantDetail = meetingParticipantExtractors.reduce(function (acc, item) {
            if (item.extract) {
                acc[item.key] = item.extract(participant, item.key);
                return acc;
            }
        }, {});

        return selectedTypesToRetrieve.map(function (type, index) {
            const qos = participant.user_qos[0][type.key]
            return qosExtractors.reduce(function (acc, item) {
                if (item.extract) {
                    acc[item.key] = item.extract(qos, item.key, item.valueType);
                    return acc;
                }
            }, Object.assign({}, participantDetail, {'id': generateId(participant, index)}, {"type": type.label}));
        });
    }, []);
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
 * Filters the Zoom Meeting Participants QoS based on the provided participantIds parameter
 * @param {Array} meetingParticipantsQos The list of Zoom Meeting Participants QoS to filter
 * @returns {Array} A filtered list of Meeting Participants QoS
 */
function filterMeetingParticipantQos(meetingParticipantsQos) {
    return meetingParticipantsQos.filter(function (meetingParticipantQos) {
        const participantId = meetingParticipantQos.participant_id
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
 * @param {Object} meetingParticipantQos - The object to insert into the output table.
 */
function insertRecord(meetingParticipantQos) {
    const recordValues = meetingParticipantQosProperties.map(function (item) {
        return meetingParticipantQos[item.key] || 'N/A';
    });
    meetingParticipantQosTable.insertRecord(sanitize(meetingParticipantQos.id), recordValues);
}

/**
 * Populates all Meeting Participants Latency and Jitter into the output table.
 * @param {Array} meetingParticipantsQos - A list of Meeting Participants Latency and Jitter objects to be inserted into the table.
 */
function populateTable(meetingParticipantsQos) {
    meetingParticipantsQos.map(function (meetingParticipantQos) {
        insertRecord(meetingParticipantQos)
    });
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveMeetingParticipantQos)
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
 * @label Get Zoom Meeting Participants QoS
 * @documentation This procedure retrieves the list of Zoom Meeting Participants QoS, filters based on roomId, and populates a table with room details
 */
function get_status() {
    login()
        .then(retrieveMeetingParticipantQos)
        .then(function (result) {
            const filteredMeetingParticipantQos = filterMeetingParticipantQos(result)
            populateTable(filteredMeetingParticipantQos);
            D.success(meetingParticipantQosTable);
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}