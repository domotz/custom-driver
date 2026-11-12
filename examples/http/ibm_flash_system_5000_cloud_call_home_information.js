/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Cloud Call Home information
 * Description: Monitors the Cloud Call Home information of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Custom Driver Variables:
 *      - Status
 *      - Connection
 *      - Error Sequence Number
 *      - Last Success
 *      - Last Failure
 *
 **/

const endpoint = "lscloudcallhome"
const variableDetails = [
    {"id": "status", "name": "Status", "extraction": "status", "valueType": D.valueType.STRING, "unit": null},
    {"id": "connection", "name": "Connection", "extraction": "connection", "valueType": D.valueType.STRING, "unit": null},
    {"id": "error_sequence_number", "name": "Error Sequence Number", "extraction": "error_sequence_number", "valueType": D.valueType.STRING, "unit": null},
    {"id": "last_success", "name": "Last Success", "extraction": "last_success", "valueType": D.valueType.DATETIME, "unit": null},
    {"id": "last_failure", "name": "Last Failure", "extraction": "last_failure", "valueType": D.valueType.DATETIME, "unit": null}
]

let result = []

/**
 * Sends an HTTPS POST request and returns the parsed JSON response.
 * @param {string} endpoint - The API endpoint.
 * @param {Object} headers - The request headers.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttps(endpoint, headers) {
    const d = D.q.defer();
    const config = {
        url: endpoint,
        protocol: "https",
        port: 7443,
        rejectUnauthorized: false,
        headers: headers
    };
    D.device.http.post(config, function (error, response, body) {
        if (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (!response) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode === 400) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            d.resolve(JSON.parse(body));
        }
    })
    return d.promise
}

/**
 * Calls an HTTPS endpoint with an authentication token.
 * @param {string} token - Auth token for the request.
 * @param {string} endpoint - The API endpoint.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttpsEndpoint(token, endpoint) {
    const headers = {"X-Auth-Token": token}
    return callHttps(endpoint, headers)
}

/**
 * Logs in using the device's credentials.
 * @returns {Promise<Object>} Parsed JSON login response.
 */
function login() {
    const endpoint = "/rest/auth"
    const headers = {
        "Content-Type": "application/json",
        'X-Auth-Username': D.device.username(),
        'X-Auth-Password': D.device.password()
    }
    return callHttps(endpoint, headers)
}

/**
 * Cleans and parses the value based on its type.
 * @param {string} value - The value to clean.
 * @param {string} valueType - Type of the value.
 * @returns {number|string} Cleaned value.
 */
function cleanValue(value, valueType) {
    if (!value) {
        return "N/A"
    }
    return valueType === D.valueType.DATETIME ? formatDate(value) : value
}

/**
 * Populates variables from the response and row definitions.
 * @param {Object} response - The API response data.
 * @param {Array} rows - Row definitions for data extraction.
 * @returns {void}
 */
function populateEndpointVariables(response, rows) {
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        result.push(D.createVariable(row.id, row.name, cleanValue(response[row.extraction], row.valueType), row.unit, row.valueType))
    }
    D.success(result)
}

/**
 * Formats a date into a string in the format 'MM-DD-YYYY HH:mm:ss'.
 * @param {String} timestamp The date .
 * @returns {string} The formatted date string.
 */
function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const year = parseInt('20' + timestamp.slice(0, 2));
    const month = parseInt(timestamp.slice(2, 4)) - 1;
    const day = parseInt(timestamp.slice(4, 6));
    const hour = parseInt(timestamp.slice(6, 8));
    const minute = parseInt(timestamp.slice(8, 10));
    const second = parseInt(timestamp.slice(10, 12));
    const dateTime = new Date(year, month, day, hour, minute, second);
    return (dateTime.getMonth() + 1) + '-' + dateTime.getDate() + '-' + dateTime.getFullYear() + ' ' + dateTime.getHours() + ':' + dateTime.getMinutes() + ':' + dateTime.getSeconds()
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpoint)
                .then(function () {
                    D.success()
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 Cloud Call Home information
 * @documentation This procedure retrieves the Cloud Call Home information of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpoint)
                .then(function (response) {
                    populateEndpointVariables(response, variableDetails)
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}