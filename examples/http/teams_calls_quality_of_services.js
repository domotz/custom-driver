/**
 * Domotz Custom Driver
 * Name: Microsoft Teams Calls Quality of Services
 * Description: Monitor Teams Calls Quality of Services.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Start Time
 *      - End Time
 *      - Version
 *      - Type
 *      - Average Audio Degradation
 *      - Average Jitter
 *      - Max Jitter
 *      - Average Packet Loss Rate
 *      - Max Packet Loss Rate
 *      - Average Concealed Samples
 *      - Max Concealed Samples
 *      - Average Round Trip Time
 *      - Max Round Trip Time
 *      - Packet Utilization
 *      - Bandwidth Estimate
 *      - Average Audio Network Jitter
 *      - Max Audio Network Jitter
 *
 **/

// Parameters for Azure authentication
const tenantId = D.getParameter('tenantId');
const clientId = D.getParameter('clientId');
const clientSecret = D.getParameter('clientSecret');

const daysBack = D.getParameter('daysBack');

const microsoftLoginService = D.createExternalDevice('login.microsoftonline.com');
const teamsManagementService = D.createExternalDevice('graph.microsoft.com');

let accessToken;
let outputTable;

let calls = 1

const callExtractors = [
    {key: "id", extract: function (call) {return sanitize(call.id)}},
    {label: 'Start Time', valueType: D.valueType.STRING, key: 'startDateTime',
        extract: function (call) {return convertToUTC(extractByKey(call, "startDateTime"))}},
    {label: 'End Time', valueType: D.valueType.STRING, key: 'endDateTime',
        extract: function (call) {return convertToUTC(extractByKey(call, "endDateTime"))}},
    {label: 'Version', valueType: D.valueType.STRING, key: 'version',
        extract: function (call) {return extractByKey(call, "version")}},
    {label: 'Type', valueType: D.valueType.STRING, key: 'type',
        extract: function (call) {return extractByKey(call, "type")}
}
];

const metricsConfig = [
    {label: "Average Audio Degradation", valueType: D.valueType.NUMBER, key: "averageAudioDegradation", callback: "average"},
    {label: "Average Jitter", valueType: D.valueType.NUMBER, unit: 'ms', key: "averageJitter", callback: "averageDuration"},
    {label: "Max Jitter", valueType: D.valueType.NUMBER, unit: 'ms', key: "maxJitter", callback: "maxDuration"},
    {label: "Average Packet Loss Rate", valueType: D.valueType.NUMBER, key: "averagePacketLossRate", callback: "average"},
    {label: "Max Packet Loss Rate", valueType: D.valueType.NUMBER, key: "maxPacketLossRate", callback: "max"},
    {label: "Average Concealed Samples", valueType: D.valueType.NUMBER, key: "averageRatioOfConcealedSamples", callback: "average"},
    {label: "Max Concealed Samples", valueType: D.valueType.NUMBER, key: "maxRatioOfConcealedSamples", callback: "max"},
    {label: "Average Round Trip Time", valueType: D.valueType.NUMBER, unit: 'ms', key: "averageRoundTripTime", callback: "averageDuration"},
    {label: "Max Round Trip Time", valueType: D.valueType.NUMBER, unit: 'ms', key: "maxRoundTripTime", callback: "maxDuration"},
    {label: "Packet Utilization", valueType: D.valueType.NUMBER, key: "packetUtilization", callback: "sum"},
    {label: "Bandwidth Estimate", valueType: D.valueType.NUMBER, key: "averageBandwidthEstimate", callback: "average"},
    {label: "Average Audio Network Jitter", valueType: D.valueType.NUMBER, unit: 'ms', key: "averageAudioNetworkJitter", callback: "averageDuration"},
    {label: "Max Audio Network Jitter", valueType: D.valueType.NUMBER, unit: 'ms', key: "maxAudioNetworkJitter", callback: "maxDuration"}
];

/**
 * Generates call properties by extracting information from the defined callInfoExtractors.
 * @returns {Array} return concatenation of `callInfoExtractors` and `performanceMetrics`.
 */
function generateProperties() {
    return callExtractors.concat(metricsConfig).filter(function (result) {
        return result.label
    });
}

/**
 * Creates a table for displaying properties.
 * using the `D.createTable`
 */
function createOutputTable(callProperties) {
    outputTable = D.createTable('Teams Calls Quality of Services', callProperties);
}

const callProperties = generateProperties()
createOutputTable(callProperties)

function extractByKey(call, key) {
    return call && call[key] ? call[key] : "N/A"
}

/**
 * Converts seconds to milliseconds.
 * @param {number} seconds - The number of seconds.
 * @returns {number} The equivalent milliseconds.
 */
function convertSecToMs(seconds) {
    return seconds * 1000;
}

/**
 * Function to convert date to UTC format
 * @param {string} dateToConvert The date string to be converted
 * @returns {string} The date string in UTC format
 */
function convertToUTC(dateToConvert) {
    const date = new Date(dateToConvert)
    const month = (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1)
    const day = (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate()
    const year = date.getUTCFullYear()
    const hours = (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours()
    const minutes = (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes()
    const seconds = (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds()
    return month + "/" + day + "/" + year + " " + hours + ":" + minutes + ":" + seconds + " UTC"
}

function parseDurationToMs(duration) {
    if (!duration) return null;
    return convertSecToMs(parseFloat(duration.replace("PT", "").replace("S", "")));
}

/**
 * Calculates a metric from a list of values based on the provided type.
 *
 * @param {Array} values - List of values to evaluate.
 * @param {string} type - The type of calculation: average, max, min, sum, averageDuration, maxDuration.
 * @returns {number|null} The result of the calculation, or null if no valid values.
 */
function calculateMetric(values, type) {
    function cleanUpValues() {
        const cleanValues = [];
        for (let i = 0; i < values.length; i++) {
            if (values[i] !== null && values[i] !== undefined) {
                cleanValues.push(values[i]);
            }
        }
        return cleanValues;
    }

    function sum(values) {
        let total = 0;
        for (let i = 0; i < values.length; i++) {
            total += values[i];
        }
        return total;
    }

    function averageDuration(values) {
        const durations = [];
        for (let i = 0; i < values.length; i++) {
            durations.push(parseDurationToMs(values[i]));
        }
        return calculateMetric(durations, "average");
    }

    function maxDuration(values) {
        const maxDurations = [];
        for (let i = 0; i < values.length; i++) {
            maxDurations.push(parseDurationToMs(values[i]));
        }
        return calculateMetric(maxDurations, "max");
    }

    const cleanValues = cleanUpValues();

    if (cleanValues.length === 0) return null;

    switch (type) {
        case "average":
            return sum(cleanValues) / cleanValues.length;
        case "max":
            return Math.max.apply(null, cleanValues);
        case "min":
            return Math.min.apply(null, cleanValues);
        case "sum":
            return sum(cleanValues);
        case "averageDuration":
            return averageDuration(cleanValues);
        case "maxDuration":
            return maxDuration(cleanValues);
        default:
            return null;
    }
}

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures.
 * @param {Object} error - The error object returned from the HTTP request.
 * @param {Object} response - The HTTP response object.
 */
function checkHTTPError(error, response) {
    if (error) {
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    } else if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode !== 200) {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Processes the login response from the Azure API and extracts the access token.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processLoginResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (bodyAsJSON.access_token) {
            accessToken = bodyAsJSON.access_token;
            d.resolve();
        } else {
            console.error("Access token not found in response body");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
    }
}

/**
 * Extracts the path and query string from a full URL.
 * @param {string} url - Full URL string.
 * @returns {string} Path and query string after the domain.
 */
function extractPathAndQuery(url) {
    const match = url.match(/^https?:\/\/[^\/]+(\/.*)/);
    return match ? match[1] : '';
}

/**
 * Processes the response from the Calls API call and extracts call information.
 * @param {Object} d - The deferred promise object.
 * @param url
 * @param callback
 * @param callbackParams
 * @returns {Function} A function to process the HTTP response.
 */
function processResponse(d, url, callback, callbackParams) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            D.failure(D.errorType.GENERIC_ERROR)
            d.reject("No response found");
            return;
        }
        const output = callback(bodyAsJSON.value, callbackParams)
        if (bodyAsJSON['@odata.nextLink']) {
            const outputWithNextPage = callGetRequest(extractPathAndQuery(bodyAsJSON['@odata.nextLink']), callback, callbackParams).then(function (nextOutput) {
                return output.concat(nextOutput)
            })
            d.resolve(outputWithNextPage)
        } else {
            d.resolve(output)
        }
    }
}

/**
 * Logs in to the microsoft cloud service using OAuth2 credentials.
 * @returns {Promise} A promise that resolves upon successful login.
 */
function login() {
    const d = D.q.defer();
    const config = {
        url: "/" + tenantId + "/oauth2/v2.0/token", protocol: "https", headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }, form: {
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://graph.microsoft.com/.default"
        }, rejectUnauthorized: false, jar: true
    };
    microsoftLoginService.http.post(config, processLoginResponse(d));
    return d.promise;
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
 * Extracts necessary information from a list of call object.
 * @param calls
 */
function extractAllCallsInfo(calls) {
    return calls.map(extractCallInfo);
}

/**
 * Extracts necessary information from a call object.
 * @param {Object} call - The call object containing various properties.
 * @returns {Object|null} The extracted call information or empty object.
 */
function extractCallInfo(call) {
    if (!call || !call.id) return null;
    const extractedInfo = {};
    callExtractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(call);
    });
    return extractedInfo;
}

/**
 * Extracts necessary information from a call object.
 * @param {Object} sessions - The call object containing various properties.
 * @param callInfo
 * @returns {Object|null} The extracted call information or empty object.
 */
function calculateSessionsQOS(sessions, callInfo) {
    const allStreams = [];

    for (let i = 0; i < sessions.length; i++) {
        const segments = sessions[i].segments;
        for (let j = 0; j < segments.length; j++) {
            const mediaList = segments[j].media;
            for (let k = 0; k < mediaList.length; k++) {
                const streams = mediaList[k].streams;
                for (let l = 0; l < streams.length; l++) {
                    allStreams.push(streams[l]);
                }
            }
        }
    }

    for (let i = 0; i < metricsConfig.length; i++) {
        let metric = metricsConfig[i];
        const values = [];

        for (let j = 0; j < allStreams.length; j++) {
            const value = allStreams[j][metric.key];
            if (value !== undefined) {
                values.push(value);
            }
        }

        callInfo[metric.key] = calculateMetric(values, metric.callback)
    }

    return callInfo;
}

/**
 * Inserts a record into the call table.
 * @param {Object} call - The call information to insert into the table.
 */
function insertRecord(call) {
    function cleanOutput(item) {
        return call[item.key] ?
            item.valueType === D.valueType.NUMBER ? call[item.key].toFixed(2) : call[item.key]
            : 'N/A'
    }

    let recordValues = callProperties.map(function (item) {
        return cleanOutput(item);
    });
    outputTable.insertRecord(call.id, recordValues);
}

/**
 * Returns the filter string for startDateTime based on daysBack.
 * @param {number} daysBack - 1 = today, 2 = yesterday, etc.
 * @returns {string} Filter string
 */
function getFilterString(daysBack) {
    const date = new Date();
    date.setDate(date.getDate() - (daysBack - 1));

    const isoDate = date.toISOString().split('T')[0] + 'T00:00:00Z';
    return '$filter=startDateTime ge ' + isoDate;
}

/**
 * Retrieves Teams calls for the subscription.
 * @returns {Promise} A promise that resolves with the call data.
 */
function retrieveCalls() {
    const url = "/v1.0/communications/callRecords?" + getFilterString(daysBack)
    return callGetRequest(url, extractAllCallsInfo)
}

/**
 * Retrieves Teams calls for the subscription.
 * @returns {Promise} A promise that resolves with the call data.
 */
function callGetRequest(url, callback, callbackParams = null) {
    const d = D.q.defer();
    const config = {
        url: url, protocol: "https",
        headers: {
            "Authorization": "Bearer " + accessToken,
        },
        rejectUnauthorized: false, jar: true
    }

    teamsManagementService.http.get(config, processResponse(d, url, callback, callbackParams));
    return d.promise;

}

/**
 * Retrieves Teams calls for the subscription.
 * @returns {Promise} A promise that resolves with the call data.
 */
function calculateCallsQOS(callInfoList) {
    const promises = []
    callInfoList.map(function (call) {
        if (call.id) {
            const url = "/v1.0/communications/callRecords/" + call.id + "/sessions?$expand=segments"
            promises.push(callGetRequest(url, calculateSessionsQOS, call))
        }
    })
    return D.q.all(promises)
}

/**
 * Populates all calls into the output table by calling insertRecord for each Call in the list.
 * @param {Array} callInfoList - A list of Call information objects to be inserted into the table.
 */
function populateTable(callInfoList) {
    callInfoList.map(insertRecord);
}

/**
 * @remote_procedure
 * @label Validate Teams connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(retrieveCalls)
        .then(function () {D.success()})
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Teams calls
 * @documentation This procedure is used to extract Teams Calls.
 */
function get_status() {
    login()
        .then(retrieveCalls)
        .then(calculateCallsQOS)
        .then(populateTable)
        .then(function () {D.success(outputTable)})
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

