/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Enclosure Statistics
 * Description: Monitors the Enclosure Statistics of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Enclosure ID
 *      - Statistic Name
 *      - Current Value
 *      - Peak Value
 *      - Peak Time
 *
 **/

const endpointDetails = {
    "endpoint": "lsenclosurestats"
}

const statisticsTable = D.createTable(
    'Statistics Details',
    [
        {label: "Enclosure ID", valueType: D.valueType.STRING},
        {label: "Statistic Name", valueType: D.valueType.STRING},
        {label: "Current Value", valueType: D.valueType.NUMBER},
        {label: "Peak Value", valueType: D.valueType.NUMBER},
        {label: "Peak Time", valueType: D.valueType.DATETIME}
    ]
);


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
        } else if (!response || response.statusCode === 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
        else if (response.statusCode !== 200) {
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
 * Populates the Enclosure Statistics table with details from a list.
 * @param {Array<Object>} statisticsList - List of managed disk details.
 */
function populateTable(statisticsList) {
    for (let i = 0; i < statisticsList.length; i++) {
        const statDetails = statisticsList[i];
        statisticsTable.insertRecord("" + (i + 1) , [
            statDetails['enclosure_id'] || "N/A",
            statDetails['stat_name'] || "N/A",
            statDetails['stat_current'] ? cleanFloatValue(statDetails['stat_current']) : "N/A",
            statDetails['stat_peak'] ? cleanFloatValue(statDetails['stat_peak']) : "N/A",
            statDetails['stat_peak_time'] ? formatDate(statDetails['stat_peak_time']) : "N/A"

        ]);
    }

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
 * Cleans and parses the Float value.
 * @param {string} value - The value to clean.
 * @returns {number|string} Cleaned value.
 */
function cleanFloatValue(value) {
    return parseFloat(value.replace(/[^0-9.]/g, ''))
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
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
 * @label Get IBM FlashSystem5000 Enclosure Statistics
 * @documentation This procedure retrieves the Enclosure Statistics of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                .then(function (response) {
                    populateTable(response)
                    D.success(statisticsTable)
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
