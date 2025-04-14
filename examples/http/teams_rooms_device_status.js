/**
 * Domotz Custom Driver
 * Name: Microsoft Teams Rooms - Device status
 * Description: Monitor Teams Rooms Devices: this script retrieves information about Room's Devices.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Model
 *      - Vendor
 *      - Type
 *      - Used by
 *      - Serial Number
 *      - Status
 *      - Activity
 *
 **/

// Parameters for Azure authentication
const tenantId = D.getParameter('tenantId');
const clientId = D.getParameter('clientId');
const clientSecret = D.getParameter('clientSecret');

const microsoftLoginService = D.createExternalDevice('login.microsoftonline.com');
const teamsManagementService = D.createExternalDevice('graph.microsoft.com');

let accessToken;
let deviceTable;

const deviceInfoExtractors = [
    {
        key: "id", extract: function (device) {return sanitize(device.id)}
    }, {
        label: 'Model', valueType: D.valueType.STRING, key: 'model', extract: function (device) {return extractFromHardwareDetailByKey(device, "model")}
    }, {
        label: 'Vendor', valueType: D.valueType.STRING, key: 'manufacturer', extract: function (device) {return extractFromHardwareDetailByKey(device, "manufacturer")}
    }, {
        label: 'Type', valueType: D.valueType.STRING, key: 'deviceType', extract: function (device) {return extractByKey(device, "deviceType")}
    }, {
        label: 'Used by', valueType: D.valueType.STRING, key: 'displayName', extract: function (device) {return extractCurrentUserByKey(device, "displayName")}
    }, {
        label: 'Serial Number', valueType: D.valueType.STRING, key: 'serialNumber', extract: function (device) {return extractFromHardwareDetailByKey(device, "serialNumber")}
    }, {
        label: 'Status', valueType: D.valueType.STRING, key: 'healthStatus', extract: function (device) {return extractByKey(device, "healthStatus")}
    }, {
        label: 'Activity', valueType: D.valueType.STRING, key: 'activityState', extract: function (device) {return extractByKey(device, "activityState")}
    }
];

/**
 * Generates device properties by extracting information from the defined deviceInfoExtractors.
 * @returns {Array} return concatenation of `deviceInfoExtractors` and `performanceMetrics`.
 */
function generateDiskProperties() {
    return deviceInfoExtractors.filter(function (result) {
        return result.label
    });
}

/**
 * Creates a table for displaying Azure Device properties.
 * using the `D.createTable`
 */
function createDiskTable(deviceProperties) {
    deviceTable = D.createTable('Microsoft Teams Devices status', deviceProperties);
}

const deviceProperties= generateDiskProperties()
createDiskTable(deviceProperties)

function extractByKey(device, key) {
    return device && device[key] ? device[key] : "N/A"
}

function extractCurrentUserByKey(device, key) {
    return device && device.currentUser && device.currentUser[key] ? device.currentUser[key] : "N/A"
}

function extractFromHardwareDetailByKey(device, key) {
    return device && device.hardwareDetail && device.hardwareDetail[key] ? device.hardwareDetail[key] : "N/A"
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
 * Processes the response from the Devices API call and extracts device information.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processDevicesResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            D.failure(D.errorType.GENERIC_ERROR)
            d.reject("No Devices found in the response");
            return;
        }
        let deviceInfoList = bodyAsJSON.value.map(extractDiskInfo);
        if (!deviceInfoList.length) {
            console.info('There is no Devices');
        }
        d.resolve(deviceInfoList);
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
 * Extracts necessary information from a device object.
 * @param {Object} device - The device object containing various properties.
 * @returns {Object|null} The extracted device information or empty object.
 */
function extractDiskInfo(device) {
    if (!device || !device.id) return null;
    const extractedInfo = {};
    deviceInfoExtractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(device);
    });
    return extractedInfo;
}

/**
 * Inserts a record into the device table.
 * @param {Object} device - The device information to insert into the table.
 */
function insertRecord(device) {
    const recordValues = deviceProperties.map(function (item) {
        return device[item.key] || 'N/A';
    });
    deviceTable.insertRecord(device.id, recordValues);
}


/**
 * Retrieves Teams devices for the subscription.
 * @returns {Promise} A promise that resolves with the device data.
 */
function retrieveDevices() {
    const d = D.q.defer();
    const config = {
        url:  "/beta/teamwork/devices",
        protocol: "https",
        headers: {
            "Authorization": "Bearer " + accessToken,
        },
        rejectUnauthorized: false,
        jar: true
    }
    teamsManagementService.http.get(config, processDevicesResponse(d));
    return d.promise;
}

/**
 * Populates all devices into the output table by calling insertRecord for each Device in the list.
 * @param {Array} deviceInfoList - A list of Device information objects to be inserted into the table.
 */
function populateTable(deviceInfoList) {
    deviceInfoList.map(insertRecord);
}

/**
 * @remote_procedure
 * @label Validate Teams connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(retrieveDevices)
        .then(function() {D.success()})
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Teams devices
 * @documentation This procedure is used to extract Teams Devices.
 */
function get_status() {
    login()
        .then(retrieveDevices)
        .then(populateTable)
        .then(function () {D.success(deviceTable)})
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
