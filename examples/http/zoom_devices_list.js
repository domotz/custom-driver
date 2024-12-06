/**
 * Domotz Custom Driver
 * Name: Zoom - Devices List
 * Description: This script retrieves information about Zoom devices connected to a specific account
 *
 * Communication protocol is HTTPS
 *
 * Tested on Zoom API v2
 *
 * requirements:
 *    - Granular Scopes: device:read:admin
 * 
 * Creates Custom Driver table with the following columns:
 *    - Device Name: The name of the Zoom device
 *    - Room ID: Unique identifier for the room to which the device is assigned
 *    - Room Name: The name of the room the device is located in
 *    - MAC Address: The MAC address of the Zoom device
 *    - Serial Number: The serial number of the device, which uniquely identifies the hardware
 *    - Vendor: The manufacturer or vendor of the Zoom device
 *    - Model: The model of the Zoom device
 *    - Platform OS: The operating system running on the Zoom device
 *    - App Version: The version of the Zoom app installed on the device
 *    - Tag: Custom tags or labels assigned to the device for categorization or filtering
 *    - Enrolled in ZDM: Indicates whether the device is enrolled in Zoom Device Management (ZDM)
 *    - Connected to ZDM: Indicates whether the device is currently connected to Zoom Device Management (ZDM)
 *    - Device Type: The type of device
 *    - SDK Version: The version of the Zoom SDK installed on the device
 *    - Device Status: The current status of the device
 *    - Last Online: Timestamp representing the last time the device was online
 *    - User Email: The email of the user associated with the device
 *
 **/

const accountId = D.getParameter('accountId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')

const zoomLogin = D.createExternalDevice('zoom.us')
const zoomResources = D.createExternalDevice('api.zoom.us')

const deviceId = D.getParameter('deviceId')
const deviceType = D.getParameter('deviceType') 

let accessToken
let pageToken
let devices = []
let pageSize = 30

const devicesExtractors = [
    {valueType: D.valueType.STRING, key: 'device_id', extract: getInfoByKey},
    {label: 'Device Name', valueType: D.valueType.STRING, key: 'device_name', extract: getInfoByKey},
    {label: 'Room ID', valueType: D.valueType.STRING, key: 'room_id', extract: getInfoByKey},
    {label: 'Room Name', valueType: D.valueType.STRING, key: 'room_name', extract: getInfoByKey},
    {label: 'MAC Address', valueType: D.valueType.STRING, key: 'mac_address', extract: getInfoByKey},
    {label: 'Serial Number', valueType: D.valueType.DATETIME, key: 'serial_number', extract: getInfoByKey},
    {label: 'Vendor', valueType: D.valueType.DATETIME, key: 'vendor', extract: getInfoByKey},
    {label: 'Model', valueType: D.valueType.NUMBER, key: 'model', extract: getInfoByKey},
    {label: 'Platform OS', valueType: D.valueType.STRING, key: 'platform_os', extract: getInfoByKey},
    {label: 'App Version', valueType: D.valueType.STRING, key: 'app_version', extract: getInfoByKey},
    {label: 'Tag', valueType: D.valueType.STRING, key: 'tag', extract: getInfoByKey},
    {label: 'Enrolled in ZDM', valueType: D.valueType.STRING, key: 'enrolled_in_zdm', extract: getInfoByKey},
    {label: 'Connected to ZDM', valueType: D.valueType.STRING, key: 'connected_to_zdm', extract: getInfoByKey},
    {label: 'Device Type', valueType: D.valueType.STRING, key: 'device_type', extract: function(row){return mapDeviceType(row.device_type)}},
    {label: 'SDK Version', valueType: D.valueType.STRING, key: 'skd_version', extract: getInfoByKey},
    {label: 'Device Status', valueType: D.valueType.STRING, key: 'device_status', extract: function(row) {return mapDeviceStatus(row.device_status)}},
    {label: 'Last Online', valueType: D.valueType.DATETIME, key: 'last_online', extract: function(row) {return formatLastOnlineDate(row.last_online) }},
    {label: 'User Email', valueType: D.valueType.STRING, key: 'user_email', extract: getInfoByKey}
]

// Create the devices table with extracted properties
const devicesProperties = devicesExtractors.filter(function (row) {
    return row.label
})

const devicesTable = D.createTable('List devices', devicesProperties)

// Function to retrieve data based on a specific key
function getInfoByKey(row, key) {
    return row[key]
}

/**
 * Maps the device type integer to its human-readable device name
 * @param {number} deviceType The device type code
 * @returns {string} The corresponding device name
 */
function mapDeviceType(deviceType) {
    const deviceTypeMap = {
        '-1': 'All Zoom Room device',
        0: 'Zoom Rooms Computer',
        1: 'Zoom Rooms Controller',
        2: 'Zoom Rooms Scheduling Display',
        3: 'Zoom Rooms Control System',
        4: 'Zoom Rooms Whiteboard',
        5: 'Zoom Phone Appliance',
        6: 'Zoom Rooms Computer (with Controller)'
    }
    return deviceTypeMap[deviceType] || 'N/A'
}

/**
 * Maps the device status integer to its human-readable status
 * @param {number} deviceStatus The device status code
 * @returns {string} The corresponding device status
 */
function mapDeviceStatus(deviceStatus) {
    const deviceStatusMap = {
        '-1': 'Unlink',
        '0': 'Offline',
        '1': 'Online'
    }
    return deviceStatusMap[deviceStatus] || 'N/A'
}

/**
 * Formats the last online date to a readable string
 * @param {string} dateString The raw date string
 * @returns {string} The formatted date string
 */
function formatLastOnlineDate(dateString) {
    const date = new Date(dateString)
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    const hours = String(date.getUTCHours()).padStart(2, '0')
    const minutes = String(date.getUTCMinutes()).padStart(2, '0')
    const seconds = String(date.getUTCSeconds()).padStart(2, '0')
    return year + '-' + month + '-' + day + ' ' + hours + ':' + minutes + ':' + seconds
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
 * @param {Object} d The deferred promise object
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
            console.error('Access token not found in response body')
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
        url: '/oauth/token', 
        protocol: 'https', 
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + D._unsafe.buffer.from(clientId + ':' + clientSecret).toString('base64')
        }, 
        form: {
            'grant_type': 'account_credentials', 
            'account_id': accountId
        }, 
        rejectUnauthorized: false, 
        jar: true
    }
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
 * Filters the devices based on provided device ID and device type
 * @param {Array} devices The list of devices to filter
 * @returns {Array} The filtered devices list
 */
function filterDevices(devices) {
    return devices.filter(function (device) {
        const associatedDevices = device.device_name
        const associatedDeviceType = mapDeviceType(device.device_type)
        const deviceIdFilter = (deviceId.length === 1 && deviceId[0].toLowerCase() === 'all') || deviceId.some(function (id) {
            return id.toLowerCase() === associatedDevices.toLowerCase()
        })
        const deviceTypeFilter = (deviceType.length === 1 && deviceType[0].toLowerCase() === 'all') || deviceType.some(function (type) {
            return type.toLowerCase() === associatedDeviceType.toLowerCase()
        })
        return deviceIdFilter && deviceTypeFilter
    })
}

/**
 * Processes the response from the device list API request
 * Handles error checking, processes the devices, and fetches additional pages if available
 * @param {Object} error The error returned by the HTTP request
 * @param {Object} response The HTTP response object
 * @param {Object} d The deferred promise object for handling async operations
 * @param {string} body The raw response body from the HTTP request
 */
function processdevicesResponse(error, response, d, body) {
    checkHTTPError(error, response)
    if (error) {
        d.reject(error)
        return
    }
    // const bodyAsJSON = JSON.parse(body)
    const bodyAsJSON = {
        'next_page_token': '',
        'page_size': 30,
        'devices': [
            {
                'device_id': 'F1C6E9DF-429E-4FA1-85DA-AC95464F3D18',
                'device_name': 'My device',
                'mac_address': '01-23-45-67-89-AB',
                'serial_number': '6NRN2A0',
                'vendor': 'Poly',
                'model': 'StudioX30',
                'platform_os': 'Epos expandvision5 1.2.22315.04',
                'app_version': '5.13.0.5762',
                'tag': 'personal rooms',
                'enrolled_in_zdm': true,
                'connected_to_zdm': true,
                'room_id': '72afdc13-a289-40c3-b358-50c8b8de',
                'room_name': 'My Personal Meeting Room',
                'device_type': 0,
                'skd_version': '2.0.11',
                'device_status': 0,
                'last_online': '2022-10-27T10:23:15Z',
                'user_email': 'test-user@ya.us'
            },
            {
                'device_id': 'F1C6E9DF-429E-4FA1-85DA-AC95464F3D18111',
                'device_name': 'My device111',
                'mac_address': '01-23-45-67-89-AB111',
                'serial_number': '6NRN2A01111',
                'vendor': 'Poly111',
                'model': 'StudioX301111',
                'platform_os': 'Epos expandvision5 1.2.22315.041111',
                'app_version': '5.13.0.5762111',
                'tag': 'personal rooms111',
                'enrolled_in_zdm': true,
                'connected_to_zdm': true,
                'room_id': '72afdc13-a289-40c3-b358-50c8b8de11111',
                'room_name': 'My Personal Meeting Room111111',
                'device_type': 1,
                'skd_version': '2.0.11111111',
                'device_status': 1,
                'last_online': '2022-12-27T12:00:00Z',
                'user_email': 'test-user@ya.us111111'
            }
        ]
    }
    if (!Array.isArray(bodyAsJSON.devices) || bodyAsJSON.devices.length === 0) {
        console.error('No devices found.')
        D.failure(D.errorType.GENERIC_ERROR)
        return
    }
    let filteredDevices = filterDevices(bodyAsJSON.devices)
    devices = devices.concat(extractdevices(filteredDevices))
    if (bodyAsJSON.next_page_token) {
        pageToken = bodyAsJSON.next_page_token
        retrieveListDevices()
            .then(function (devices) {
                d.resolve(devices)
            })
            .catch(function (err) {
                console.error('Error fetching next page of devices:', err)
                d.reject(err)
            })
    } else {
        console.log('All devices retrieved successfully.')
        d.resolve(devices)
    }
}

function generateConfig() {
    const url = '/v2/devices?page_size=' + pageSize
    return {
        url: pageToken ? url + '&next_page_token=' + pageToken : url, 
        protocol: 'https', 
        headers: {
            'Authorization': 'Bearer ' + accessToken
        }, 
        rejectUnauthorized: false, 
        jar: true
    }
}

/**
 * Makes the HTTP GET request to retrieve the list of devices and returns a promise
 * @returns {Promise} A promise that resolves with the list of devices
 */
function retrieveListDevices() {
    const d = D.q.defer()
    const config = generateConfig()
    zoomResources.http.get(config, function (error, response, body) {
        processdevicesResponse(error, response, d, body)
    })
    return d.promise
}

/**
 * Extracts the relevant information from a list of devices
 * @param {Array} listDevices The list of devices to be processed
 * @returns {Array} A list of objects with extracted device information
 */
function extractdevices(listDevices) {
    return listDevices.map(function (device) {
        return devicesExtractors.reduce(function (acc, item) {
            acc[item.key] = item.extract ? item.extract(device, item.key) : 'N/A'
            return acc
        }, {})
    })
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
 * Inserts a new record into the devices table for a given Zoom device
 * Maps the properties of the device to the corresponding table columns and inserts it
 * @param {Array} zoomDevices The list of devices retrieved from the Zoom API
 */
function insertRecord(zoomDevices) {
    const recordValues = devicesProperties.map(function (item) {
        return zoomDevices[item.key] || 'N/A'
    })
    devicesTable.insertRecord(sanitize(zoomDevices.device_id), recordValues)
}

/**
 * Populates the devices table with records for all Zoom devices
 * @param {Array} zoomDevices The list of devices to populate the table with
 */
function populateTable(zoomDevices) {
    zoomDevices.map(function (device) {
        insertRecord(device)
    })
    D.success(devicesTable)
}

/**
 * @remote_procedure
 * @label Validate Zoom connection
 * @documentation This procedure is used to validate if the Zoom API is accessible and if the login credentials are correct
 */
function validate() {
    login()
        .then(retrieveListDevices)
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
 * @label Get Zoom Devices
 * @documentation This procedure retrieves the list of Zoom devices and populates the table with the device data.
 */
function get_status() {
    login()
        .then(retrieveListDevices)
        .then(populateTable)
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}