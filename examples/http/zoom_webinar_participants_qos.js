/**
 * Domotz Custom Driver
 * Name: Webinar Participants Quality of Service
 * Description: This script retrieves information about Zoom Webinar Participants Quality of Service
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 * Granular Scopes: dashboard:read:list_webinar_participants_qos:admin
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

const webinarId = D.getParameter('webinarId')
const participantIds = D.getParameter('participantIds')

const zoomLogin = D.createExternalDevice("zoom.us")
const zoomResources = D.createExternalDevice("api.zoom.us")

let accessToken
let pageToken
let webinarParticipantQos = []
let pageSize = 30

const webinarParticipantExtractors = [{
    valueType: D.valueType.STRING, key: 'participant_id', extract: getParticipantByKey
}, {
    label: 'User Name', valueType: D.valueType.STRING, key: 'user_name', extract: getParticipantByKey
}, {
    label: 'Email', valueType: D.valueType.STRING, key: 'email', extract: getParticipantByKey
}];

const qosExtractors = [{label: 'Type', valueType: D.valueType.STRING, key: 'type', extract: getQosType}, {
    label: 'Minimum Bitrate', valueType: D.valueType.NUMBER, unit: 'kbps', key: 'min_bitrate', extract: getQosDetailByKey
}, {
    label: 'Average Bitrate', valueType: D.valueType.NUMBER, unit: 'kbps', key: 'avg_bitrate', extract: getQosDetailByKey
}, {
    label: 'Maximum Bitrate', valueType: D.valueType.NUMBER, unit: 'kbps', key: 'max_bitrate', extract: getQosDetailByKey
}, {
    label: 'Minimum Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'min_latency', extract: getQosDetailByKey
}, {
    label: 'Average Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'avg_latency', extract: getQosDetailByKey
}, {
    label: 'Maximum Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'max_latency', extract: getQosDetailByKey
}, {
    label: 'Minimum Jitter', valueType: D.valueType.NUMBER, unit: 'ms', key: 'min_jitter', extract: getQosDetailByKey
}, {
    label: 'Average Jitter', valueType: D.valueType.NUMBER, unit: 'ms', key: 'avg_jitter', extract: getQosDetailByKey
}, {
    label: 'Maximum Jitter', valueType: D.valueType.NUMBER, unit: 'ms', key: 'max_jitter', extract: getQosDetailByKey
}, {
    label: 'Minimum Packet Loss', valueType: D.valueType.NUMBER, unit: '%', key: 'min_loss', extract: getQosDetailByKey
}, {
    label: 'Average Packet Loss', valueType: D.valueType.NUMBER, unit: '%', key: 'avg_loss', extract: getQosDetailByKey
}, {
    label: 'Maximum Packet Loss', valueType: D.valueType.NUMBER, unit: '%', key: 'max_loss', extract: getQosDetailByKey
}, {
    label: 'Resolution', valueType: D.valueType.STRING, key: 'resolution', extract: getQosDetailByKey
}, {
    label: 'Minimum Frame Rate', valueType: D.valueType.NUMBER, unit: 'fps', key: 'min_frame_rate', extract: getQosDetailByKey
}, {
    label: 'Average Frame Rate', valueType: D.valueType.NUMBER, unit: 'fps', key: 'avg_frame_rate', extract: getQosDetailByKey
}, {
    label: 'Maximum Frame Rate', valueType: D.valueType.NUMBER, unit: 'fps', key: 'max_frame_rate', extract: getQosDetailByKey
}, {
    label: 'Zoom Minimum CPU Usage', valueType: D.valueType.NUMBER, unit: '%', key: 'zoom_min_cpu_usage', extract: getQosDetailByKey
}, {
    label: 'Zoom Average CPU Usage', valueType: D.valueType.NUMBER, unit: '%', key: 'zoom_avg_cpu_usage', extract: getQosDetailByKey
}, {
    label: 'Zoom Maximum CPU Usage', valueType: D.valueType.NUMBER, unit: '%', key: 'zoom_max_cpu_usage', extract: getQosDetailByKey
}, {
    label: 'System Maximum CPU Usage', valueType: D.valueType.NUMBER, unit: '%', key: 'system_max_cpu_usage', extract: getQosDetailByKey
}];

const webinarParticipantQosExtractors = webinarParticipantExtractors.concat(qosExtractors)
const webinarParticipantQosProperties = webinarParticipantQosExtractors.filter(function (row) {
    return row.label
})

const webinarParticipantQosTable = D.createTable("Webinar Participants Quality of Service", webinarParticipantQosProperties)

/**
 * Retrieves the value of a specific key from an object.
 * @param {Object} row
 * @param {string} key
 */
function getParticipantByKey(row, key) {
    return row[key]
}

/**
 * Retrieves the value of a specific key from the details property of an object.
 * @param {Object} row
 * @param {string} key
 */
function getQosDetailByKey(row, key) {
    return row.details[key]
}

/**
 * Retrieves the type property of an object.
 * @param {Object} row
 */
function getQosType(row) {
    return row.type
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
 * Processes the Webinar Participant QoS data and handles pagination if necessary.
 * @param {Error|null} error - The error object, if any, from the API response.
 * @param {Object} response - The HTTP response object.
 * @param {Object} d - A deferred object for resolving or rejecting the promise.
 * @param {string} body - The raw response body as a JSON string.
 */
function processWebinarParticipantQos(error, response, d, body) {
    checkHTTPError(error, response)
    if (error) {
        d.reject(error)
        return
    }
    const bodyAsJSON = JSON.parse(body)

    if (!Array.isArray(bodyAsJSON.participants) || bodyAsJSON.participants.length === 0) {
        console.error("No Webinar Participants QoS found.")
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    webinarParticipantQos = webinarParticipantQos.concat(extractWebinarParticipantQos(bodyAsJSON))
    if (bodyAsJSON.next_page_token) {
        pageToken = bodyAsJSON.next_page_token
        retrieveWebinarParticipantQos()
            .then(function (Qos) {
                d.resolve(Qos)
            })
            .catch(function (err) {
                console.error("Error fetching next page of Webinar Participants QoS:", err)
                d.reject(err)
            })
    } else {
        console.log("All Webinar Participants QoS retrieved successfully.")
        d.resolve(webinarParticipantQos)
    }
}

/**
 * Generates the configuration object for the API request.
 * @returns {Object} - The configuration object containing the API endpoint, headers, and options.
 */
function generateConfig() {
    const url = "/v2/metrics/webinars/" + webinarId + "/participants/qos_summary?page_size=" + pageSize
    return {
        url: pageToken ? url + "&next_page_token=" + pageToken : url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieve Webinar Participants Qos.
 * @returns {promise}
 */
function retrieveWebinarParticipantQos() {
    const d = D.q.defer()
    const config = generateConfig();
    zoomResources.http.get(config, function (error, response, body) {
        processWebinarParticipantQos(error, response, d, body);
    })
    return d.promise
}

/**
 * Extracts relevant information from a Zoom room response
 * @param {Object} webinarParticipantQos The raw Zoom room data
 * @returns {Object} A simplified object with only necessary fields
 */
function extractWebinarParticipantQos(webinarParticipantQos) {
    return webinarParticipantQos.participants.reduce(function (participantsAcc, participant) {
        const participantDetail = webinarParticipantExtractors.reduce(function (acc, item) {
            acc[item.key] = item.extract(participant, item.key);
            return acc;
        }, {});

        const qosData = participant.qos.reduce(function (qosAcc, qos) {
            const mergedData = qosExtractors.reduce(function (acc, item) {
                acc[item.key] = item.extract(qos, item.key);
                return acc;
            }, Object.assign({}, participantDetail));

            qosAcc.push(mergedData);
            return qosAcc;
        }, []);

        return participantsAcc.concat(qosData);
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
 * Filters the Zoom Webinar Participants QoS based on the provided participantIds parameter
 * @param {Array} webinarParticipantsQos The list of Zoom Webinar Participants QoS to filter
 * @returns {Array} A filtered list of Webinar Participants QoS
 */
function filterWebinarParticipantQos(webinarParticipantsQos) {
    return webinarParticipantsQos.filter(function (webinarParticipantQos) {
        const participantId = webinarParticipantQos.participant_id
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
 * @param {Object} webinarParticipantQos - The object to insert into the output table.
 */
function insertRecord(webinarParticipantQos) {
    const recordValues = webinarParticipantQosProperties.map(function (item) {
        return webinarParticipantQos[item.key] || 'N/A';
    });
    webinarParticipantQosTable.insertRecord(sanitize(webinarParticipantQos.participant_id), recordValues);
}

/**
 * Populates all Webinar Participants Quality of Service into the output table.
 * @param {Array} webinarParticipantsQos - A list of Webinar Participants Quality of Service objects to be inserted into the table.
 */
function populateTable(webinarParticipantsQos) {
    webinarParticipantsQos.map(function (webinarParticipantQos) {
        insertRecord(webinarParticipantQos)
    });
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveWebinarParticipantQos)
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
 * @label Get Zoom Webinar Participants QoS
 * @documentation This procedure retrieves the list of Zoom Webinar Participants QoS, filters based on roomId, and populates a table with room details
 */
function get_status() {
    login()
        .then(retrieveWebinarParticipantQos)
        .then(function (result) {
            const filteredWebinarParticipantQos = filterWebinarParticipantQos(result)
            populateTable(filteredWebinarParticipantQos);
            D.success(webinarParticipantQosTable);
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}