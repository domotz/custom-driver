/**
 * Domotz Custom Driver
 * Name: Microsoft Teams Rooms - Device status
 * Description: This script retrieves information about Room Devices, including detailed health status for each device.
 *
 * Tested on Microsoft Graph API beta
 *
 * Communication protocol is HTTPS
 *
 * requirements:
 *    Grant permission to extract the list of room devices and  health details: TeamworkDevice.Read.All
 *
 * Input Parameters:
 *    - tenantId: The Azure Active Directory Tenant ID for your Microsoft Teams organization
 *    - clientId: The Application (client) ID of the registered Azure AD application
 *    - clientSecret: The client secret credential used for authentication with the Azure AD application
 *    - filterByDeviceSerialNumber: A boolean flag (true/false) that controls device filtering behavior
 *        * If set to "true": The script will extract and display only the device with a serial number matching
 *          the Domotz monitored device's serial number from all devices retrieved from Microsoft Teams
 *        * If set to "false" or any other value: The script will extract and display all devices from Microsoft Teams
 *
 * Creates a custom driver with the following columns:
 *    - Model: Represents the model or type of the device
 *    - Vendor: Denotes the manufacturer or vendor of the device
 *    - Type: The category or kind of the device
 *    - Used by: The user or department that is assigned or utilizing the device
 *    - Serial Number: The unique serial number assigned to the device for identification
 *    - Health Status: Provides the current health or status of the device, indicating whether it is operating normally or has issues
 *    - Activity: The current activity state of the device
 *    - Connection Status: Indicates the status of the device's network connection
 *    - Exchange Login Status: Reflects the login status with Exchange, which may affect email functionality
 *    - Teams Login Status: Shows the device's login status within Microsoft Teams, impacting its ability to participate in meetings
 *    - Room Camera: Health status of the camera used in the room
 *    - Content Camera: Similar to the Room Camera, it reflects the status of the content camera
 *    - Speaker: The health of the speaker device, which can impact audio during meetings
 *    - Communication Speaker: A specific speaker used for communication, indicating its health
 *    - Microphone: Represents the status of the microphone device
 *    - OS Update Status: Displays the status of the operating system's software update
 *    - Admin Agent Update Status: Indicates whether the admin agent software is up-to-date
 *    - Company Portal Update Status: The status of the update for the company portal application
 *    - Teams Client Update Status: Displays if the Teams client is up-to-date
 *    - Firmware Update Status: Reflects the status of any firmware updates
 *    - Partner Agent Update Status: Status of the partner agent software update
 *    - Compute Health: Represents the health of the device's computing components
 *    - HDMI Ingest: Indicates the health of HDMI video inputs, relevant for content sharing during meetings
 *
 * Dynamically creates columns for each external display connected to the room system.
 * These come from the displayHealthCollection data, and for each display, a column will appear showing its connection status like:
 *      - Display 1 Status: Connection status of the first display.
 *      - Display 2 Status: Connection status of the second display.
 *      - ...
 * The number of these columns changes automatically depending on how many displays are reported by the system.
 **/

/**
 * @description Teams Rooms Tenant Id
 * @type STRING 
 */
var tenantId = D.getParameter('tenantId');

/**
 * @description Teams Rooms Client Id
 * @type STRING 
 */
var clientId = D.getParameter('clientId');

/**
 * @description Teams Rooms Client Secret
 * @type SECRET_TEXT 
 */
var clientSecret = D.getParameter('clientSecret');

/**
 * @description Flag to filter by device serial number
 * @type STRING 
 */
var filterByDeviceSerialNumber = D.getParameter('filterByDeviceSerialNumber');


const microsoftLoginService = D.createExternalDevice('login.microsoftonline.com')
const teamsManagementService = D.createExternalDevice('graph.microsoft.com')

let accessToken
let deviceTable
let deviceProperties

const deviceInfoExtractors = [{
    key: "id", extract: function (device) {
        return sanitize(device.id)
    }
}, {
    label: 'Model', valueType: D.valueType.STRING, key: 'model', extract: function (device) {
        return extractFromHardwareDetailByKey(device, "model")
    }
}, {
    label: 'Vendor', valueType: D.valueType.STRING, key: 'manufacturer', extract: function (device) {
        return extractFromHardwareDetailByKey(device, "manufacturer")
    }
}, {
    label: 'Type', valueType: D.valueType.STRING, key: 'deviceType', extract: function (device) {
        return extractByKey(device, "deviceType")
    }
}, {
    label: 'Used by', valueType: D.valueType.STRING, key: 'displayName', extract: function (device) {
        return extractCurrentUserByKey(device, "displayName")
    }
}, {
    label: 'Serial Number', valueType: D.valueType.STRING, key: 'serialNumber', extract: function (device) {
        return extractFromHardwareDetailByKey(device, "serialNumber")
    }
}, {
    label: 'Health Status', valueType: D.valueType.STRING, key: 'healthStatus', extract: function (device) {
        return extractByKey(device, "healthStatus")
    }
}, {
    label: 'Activity', valueType: D.valueType.STRING, key: 'activityState', extract: function (device) {
        return extractByKey(device, "activityState")
    }
}]

const deviceHealthExtractors = [{
    label: 'Connection Status',
    valueType: D.valueType.STRING,
    key: 'connectionStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['connection', 'connectionStatus'])
    }
}, {
    label: 'Exchange Login Status',
    valueType: D.valueType.STRING,
    key: 'exchangeLoginStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['loginStatus', 'exchangeConnection', 'connectionStatus'])
    }
}, {
    label: 'Teams Login Status',
    valueType: D.valueType.STRING,
    key: 'teamsLoginStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['loginStatus', 'teamsConnection', 'connectionStatus'])
    }
}, {
    label: 'Room Camera',
    valueType: D.valueType.STRING,
    key: 'roomCameraHealth',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'roomCameraHealth', 'connection', 'connectionStatus'])
    }
}, {
    label: 'Content Camera',
    valueType: D.valueType.STRING,
    key: 'contentCameraHealth',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'contentCameraHealth', 'connection', 'connectionStatus'])
    }
}, {
    label: 'Speaker',
    valueType: D.valueType.STRING,
    key: 'speakerHealth',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'speakerHealth', 'connection', 'connectionStatus'])
    }
}, {
    label: 'Communication Speaker',
    valueType: D.valueType.STRING,
    key: 'communicationSpeakerHealth',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'communicationSpeakerHealth', 'connection', 'connectionStatus'])
    }
}, {
    label: 'Microphone',
    valueType: D.valueType.STRING,
    key: 'microphoneHealth',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['peripheralsHealth', 'microphoneHealth', 'connection', 'connectionStatus'])
    }
}, {
    label: 'OS Update Status',
    valueType: D.valueType.STRING,
    key: 'operatingSystemSoftwareUpdateStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'operatingSystemSoftwareUpdateStatus'])
    }
}, {
    label: 'Admin Agent Update Status',
    valueType: D.valueType.STRING,
    key: 'adminAgentSoftwareUpdateStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'adminAgentSoftwareUpdateStatus', 'softwareFreshness'])
    }
}, {
    label: 'Company Portal Update Status',
    valueType: D.valueType.STRING,
    key: 'companyPortalSoftwareUpdateStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'companyPortalSoftwareUpdateStatus', 'softwareFreshness'])
    }
}, {
    label: 'Teams Client Update Status',
    valueType: D.valueType.STRING,
    key: 'teamsClientSoftwareUpdateStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'teamsClientSoftwareUpdateStatus', 'softwareFreshness'])
    }
}, {
    label: 'Firmware Update Status',
    valueType: D.valueType.STRING,
    key: 'firmwareSoftwareUpdateStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'firmwareSoftwareUpdateStatus', 'softwareFreshness'])
    }
}, {
    label: 'Partner Agent Update Status',
    valueType: D.valueType.STRING,
    key: 'partnerAgentSoftwareUpdateStatus',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['softwareUpdateHealth', 'partnerAgentSoftwareUpdateStatus', 'softwareFreshness'])
    }
}, {
    label: 'Compute Health',
    valueType: D.valueType.STRING,
    key: 'computeHealth',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['hardwareHealth', 'computeHealth', 'connection', 'connectionStatus'])
    }
}, {
    label: 'HDMI Ingest',
    valueType: D.valueType.STRING,
    key: 'hdmiIngestHealth',
    extract: function (deviceHealth) {
        return extractFromHealthByPath(deviceHealth, ['hardwareHealth', 'hdmiIngestHealth', 'connection', 'connectionStatus'])
    }
}]

/**
 * Combines device and health extractors to generate a complete list of device properties.
 * @returns {Array} - Combined list of device properties.
 */
function generateDeviceProperties() {
    return deviceInfoExtractors.concat(deviceHealthExtractors).filter(function (result) {
        return result.label
    })
}

/**
 * Creates a table for displaying the status of Microsoft Teams Devices.
 * @param {Array} deviceProperties - List of device properties to include in the table.
 */
function createDeviceTable(deviceProperties) {
    tableHeaders = deviceProperties.map(function(item) {return { label: item.label }});

    deviceTable = D.createTable('Microsoft Teams Devices status', tableHeaders)
}

/**
 * Creates variables for displaying device information when filtering by serial number.
 * @param {Object} device - The device information to create variables for.
 * @returns {Array} - Array of D.createVariable objects.
 */
function createVariables(device) {
    var variables = [];
    
    // Add device ID as the first variable
    variables.push(D.createVariable(
        "id", 
        "Device ID", 
        device.id || 'N/A', 
        null, 
        D.valueType.STRING
    ));
    
    deviceProperties.forEach(function(property) {
        if (property.label) {
            var value = device[property.key] || 'N/A';
            variables.push(D.createVariable(
                property.key, 
                property.label, 
                value, 
                null, 
                D.valueType.STRING
            ));
        }
    });

    const mstRoomsUrl = 'https://admin.teams.microsoft.com/devices/collaborationbars/' + device.id;

    variables.push(D.createMetric({
        uid: 'MST-Rooms-url-link',
        name: 'MST Rooms URL link',
        value: mstRoomsUrl,
                    metadata: {'url': mstRoomsUrl},
        valueType: D.valueType.NUMBER,
        unit: "%"}));

    return variables;
}

/**
 * Extracts a property directly from the device using the provided key.
 * @param {Object} device - The device object.
 * @param {string} key - The key to extract.
 * @returns {string} - The extracted value or "N/A".
 */
function extractByKey(device, key) {
    return device && device[key] ? device[key] : 'N/A'
}

/**
 * Extracts a value from the currentUser sub-object using the provided key.
 * @param {Object} device - The device object.
 * @param {string} key - The key to extract from currentUser.
 * @returns {string} - The extracted value or "N/A".
 */
function extractCurrentUserByKey(device, key) {
    return device && device.currentUser && device.currentUser[key] ? device.currentUser[key] : 'N/A'
}

/**
 * Extracts a value from the hardwareDetail sub-object using the provided key.
 * @param {Object} device - The device object.
 * @param {string} key - The key to extract from hardwareDetail.
 * @returns {string} - The extracted value or "N/A".
 */
function extractFromHardwareDetailByKey(device, key) {
    return device && device.hardwareDetail && device.hardwareDetail[key] ? device.hardwareDetail[key] : 'N/A'
}

/**
 * Extracts a nested value from a health object based on a key path array.
 * @param {Object} deviceHealth - The device health object.
 * @param {Array} key - Array of keys representing the path to the value.
 * @returns {string} - The extracted value or "N/A".
 */
function extractFromHealthByPath(deviceHealth, key) {
    let value = deviceHealth;
    for (let i = 0; i < key.length; i++) {
        if (value && value[key[i]] !== undefined) {
            value = value[key[i]]
        } else {
            return "N/A"
        }
    }
    return (value === "unknown") ? "N/A" : value
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
            console.error("Access token not found in response body")
            D.failure(D.errorType.AUTHENTICATION_ERROR)
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
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (!bodyAsJSON.value) {
            console.error("No Devices found in the response")
            D.failure(D.errorType.GENERIC_ERROR)
        }
        let deviceInfoList = bodyAsJSON.value.map(extractDevicesInfo)
        if (!deviceInfoList.length) {
            console.info('There is no Devices')
        }
        d.resolve(deviceInfoList)
    }
}

/**
 * Extends device health extractors to include display health statuses.
 * @param {Object} deviceHealth - The health data for a device.
 */
function extendDisplayExtractors(deviceHealth) {
    const displays = (deviceHealth && deviceHealth.peripheralsHealth && deviceHealth.peripheralsHealth.displayHealthCollection) || []
    displays.forEach(function (display, index) {
        const displayKey = 'display_' + (index + 1) + '_status'
        if (!deviceHealthExtractors.some(function(extractor){ return extractor.key === displayKey })) {
            deviceHealthExtractors.push({
                label: 'Display ' + (index + 1) + ' Status',
                valueType: D.valueType.STRING,
                key: displayKey,
                extract: function (health) {
                    return (
                        health && health.peripheralsHealth &&
                        health.peripheralsHealth.displayHealthCollection &&
                        health.peripheralsHealth.displayHealthCollection[index] &&
                        health.peripheralsHealth.displayHealthCollection[index].connection &&
                        health.peripheralsHealth.displayHealthCollection[index].connection.connectionStatus
                    ) || "N/A"
                }
            })
        }
    })
}

/**
 * Processes the response from the health API and extracts relevant device health info.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processDeviceHelthResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (!bodyAsJSON) {
            console.error('No health status found in the response')
        }
        extendDisplayExtractors(bodyAsJSON)
        deviceProperties = generateDeviceProperties()
        
        // Only create device table if not filtering by serial number
        if (filterByDeviceSerialNumber.trim().toLowerCase() !== "true") {
            createDeviceTable(deviceProperties)
        }
        
        const deviceHealthInfo = extractDeviceHealthInfo(bodyAsJSON)
        d.resolve(deviceHealthInfo)
    }
}

/**
 * Logs in to the microsoft cloud service using OAuth2 credentials.
 * @returns {Promise} A promise that resolves upon successful login.
 */
function login() {
    const d = D.q.defer()
    const config = {
        url: "/" + tenantId + "/oauth2/v2.0/token", protocol: "https", headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }, form: {
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://graph.microsoft.com/.default"
        }, rejectUnauthorized: false, jar: true
    }
    microsoftLoginService.http.post(config, processLoginResponse(d))
    return d.promise
}

/**
 * Generalized extraction function for device and health info
 * @param {Object} source - The data source (device or health data)
 * @param {Array} extractors - The array of extractors to process
 * @returns {Object} - Extracted values
 */
function extractInfo(source, extractors) {
    const result = {}
    extractors.forEach(function (row) {
        result[row.key] = row.extract(source)
    })
    return result
}

/**
 * Extracts device information from the source device data using the defined extractors.
 * @param {Object} device - The device object containing various properties.
 * @returns {Object} - Extracted device information.
 */
function extractDevicesInfo(device) {
    if (!device || !device.id) return null
    return extractInfo(device, deviceInfoExtractors)
}

/**
 * Extracts device health information from the source health data using the defined extractors.
 * @param {Object} deviceHealth - The health data of the device.
 * @returns {Object} - Extracted device health information.
 */
function extractDeviceHealthInfo(deviceHealth) {
    const info = extractInfo(deviceHealth, deviceHealthExtractors)
    info.id = deviceHealth.id
    return info
}

/**
 * Retrieves Teams devices for the subscription.
 * @returns {Promise} A promise that resolves with the device data.
 */
function retrieveDevices() {
    const d = D.q.defer()
    const config = {
        url:  "/beta/teamwork/devices",
        protocol: "https",
        headers: {
            "Authorization": "Bearer " + accessToken,
        },
        rejectUnauthorized: false,
        jar: true
    }
    teamsManagementService.http.get(config, processDevicesResponse(d))
    return d.promise
}

/**
 * Inserts a record into the device table.
 * @param {Object} device - The device information to insert into the table.
 */
function insertRecord(device) {
    const recordValues = deviceProperties.map(function (item) {
        return device[item.key] || 'N/A'
    })
    deviceTable.insertRecord(device.id, recordValues)
}

/**
 * Retrieves the health information for each device.
 * @param {Array} device - Array of devices to fetch health information for.
 * @returns {Promise} - A promise that resolves with the health data for all devices.
 */
function retrieveDeviceHealthInfo(device) {
    const promises = device.map(function (item) {
        const d = D.q.defer()
        const config = {
            url: "/beta/teamwork/devices/" + item.id + "/health", protocol: "https", headers: {
                "Authorization": "Bearer " + accessToken,
            }, rejectUnauthorized: false, jar: true
        }
        teamsManagementService.http.get(config, processDeviceHelthResponse(d))
        return d.promise
    })
    return D.q.all(promises)
}


/**
 * Merges device information with its corresponding health information.
 * @param {Array} devices - List of devices to merge health info into.
 * @param {Array} healthList - List of health data corresponding to the devices.
 * @returns {Array} - List of devices with merged health information.
 */
function mergeDevicesWithHealth(devices, healthList) {
    if (!devices || devices.length === 0) return []
    return devices.map(function (device) {
        var health = null
        for (var i = 0; i < healthList.length; i++) {
            if (healthList[i] && healthList[i].id === device.id) {
                health = healthList[i]
                break
            }
        }
        if (health) {
            var merged = {}
            for (var key in device) {
                merged[key] = device[key]
            }
            for (var helthKey in health) {
                if (helthKey !== 'id') {
                    merged[helthKey] = health[helthKey]
                }
            }
            return merged
        }
        return device
    })
}

/**
 * Populates all devices into the output table by calling insertRecord for each Device in the list.
 * @param {Array} deviceInfoList - A list of Device information objects to be inserted into the table.
 */
function populateTable(deviceInfoList) {
    deviceInfoList.map(insertRecord)
}

/**
 * @remote_procedure
 * @label Validate Teams connection
 * @documentation This procedure is used to validate connectivity and permission by ensuring Teams Devices data and health details are accessible via the Microsoft Graph API.
 */
function validate() {
    login()
        .then(retrieveDevices)
        .then(function (devices) {
            return retrieveDeviceHealthInfo(devices)
                .then(function () {D.success()})
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

function filterDevices(devices)
{
    let filteredDevices = devices
    if (filterByDeviceSerialNumber.trim().toLowerCase() === "true") {
        console.info("Device Serial" + D.device.serial())

        filteredDevices = devices.filter(function(device) {
            console.info("Teams Serial" + device.serialNumber)        
            return device.serialNumber && D.device.serial() && device.serialNumber.toLowerCase() === D.device.serial().toLowerCase()
        })
    }
    return filteredDevices
}

/**
 * @remote_procedure
 * @label Get Teams devices
 * @documentation This procedure is used to extract Microsoft Teams Rooms Devices, including general information and detailed health status for each device
 */
function get_status() {
    login()
        .then(retrieveDevices)
        .then(filterDevices)
        .then(function (devices) {
            return retrieveDeviceHealthInfo(devices)
                .then(function (healthList) {
                    const mergedDevices = mergeDevicesWithHealth(devices, healthList)
                    console.log(mergedDevices)
                    
                    if (filterByDeviceSerialNumber.trim().toLowerCase() === "true") {
                        // When filtering by serial number, use variables instead of table
                        if (mergedDevices.length > 0) {
                            const variables = createVariables(mergedDevices[0])
                            D.success(variables)
                        } else {
                            console.info('No matching device found for the serial number')
                            D.success([])
                        }
                    } else {
                        // Use table for multiple devices
                        populateTable(mergedDevices)
                        D.success(deviceTable)
                    }
                })
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}