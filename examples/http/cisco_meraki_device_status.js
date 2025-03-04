/**
 * Domotz Custom Integration
 * Name: Cisco Meraki - Device Status for an Organization
 * Description: This script retrieves device availability data from Cisco Meraki and displays it in Domotz.
 *
 * Communication protocol is HTTPS
 *
 * Required Parameters:
 *      - apiKey (Secret Text) -> Meraki API Key
 *      - organizationId (Text) -> Organization ID
 *
 * Tested on Cisco Meraki Dashboard API v1
 *
 * Creates a Custom Driver table with the following columns:
 *      - Device Name: The name of the device
 *      - Status: The current status of the device
 *      - Device MAC Address: The MAC address of the device
 *      - Lan IP Address: The IP address assigned to the device
 *      - IP Type: The type of IP address configuration for the device
 *      - Network ID: The identifier for the network the device is connected to
 *      - Product Type: The type of product or device
 *      - Model: The specific model of the device
 *      - Tags: Any tags associated with the device
 *
 */

/**
 * @description Meraki API Key for Authentication
 * @type SECRET_TEXT
 */
const apiKey = D.getParameter("apiKey")

/**
 * @description Organization ID for the organization to monitor
 * @type STRING
 */
const organizationId = D.getParameter("organizationId")

// External Device representing the Meraki API endpoint
const externalDevice = D.createExternalDevice("api.meraki.com")

// URL for accessing the organization's data from Meraki API
const organizationUrl = '/api/v1/organizations/' + encodeURIComponent(organizationId)

const table = D.createTable("Meraki Device Statuses", [
    { label: "Device Name", valueType: D.valueType.STRING },
    { label: "Status", valueType: D.valueType.STRING },
    { label: "Device MAC Address", valueType: D.valueType.STRING },
    { label: "LAN IP Address", valueType: D.valueType.STRING },
    { label: "IP Type", valueType: D.valueType.STRING },
    { label: "Network ID", valueType: D.valueType.STRING },
    { label: "Product Type", valueType: D.valueType.STRING },
    { label: "Model", valueType: D.valueType.STRING },
    { label: "Tags", valueType: D.valueType.STRING }
])

/**
 * @description Creates options for the API request to Meraki
 * @param {string} url The API endpoint URL
 * @returns {Object} The configuration object for the request
 */
function createRequestOptions(url){
    return {
        url: url,
        protocol: 'https',
        headers: {
            'Content-Type': 'application/json',
            'X-Cisco-Meraki-API-Key': apiKey
        }
    }
}

/**
 * @description Handles errors from the Meraki API response
 * @param {Object} error The error object returned from the API request
 * @param {Object} response The response object from the API request
 * @param {string} body The response body from the API request
 * @returns {Object|null} A failure object if an error is encountered, otherwise null
 */
function handleApiError(error, response, body) {
    if (error) {
        console.error(error)
        return D.failure(D.errorType.GENERIC_ERROR)
    }
    if (response.statusCode === 404) {
        return D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    }
    if (response.statusCode === 401) {
        console.error('Invalid API Key')
        return D.failure(D.errorType.AUTHENTICATION_ERROR)
    }
    if (response.statusCode !== 200) {
        console.error("Unexpected response:", body)
        return D.failure(D.errorType.GENERIC_ERROR)
    }
    return null
}

/**
 * @description Makes an API request to Meraki to fetch the response
 * @param {string} url The API endpoint URL
 * @returns {Promise} A promise that resolves with the parsed response data or rejects with an error
 */
function getApiResponse(url) {
    const d = D.q.defer()
    const requestOptions = createRequestOptions(url)
    externalDevice.http.get(requestOptions, function (error, response, body) {
        const errorResponse = handleApiError(error, response, body)
        if (errorResponse) {
            d.reject(errorResponse)
            return
        }
        if (body) {
            const parsedBody = JSON.parse(body)
            d.resolve(parsedBody)
        } else {
            D.failure(D.errorType.PARSING_ERROR)
        }
    })
    return d.promise
}

/**
 * @description Retrieves the device availability statuses for the organization
 * @returns {Promise} A promise that resolves with the device statuses
 */
function getDeviceStatuses() {
    return getApiResponse(organizationUrl + '/devices/statuses')
}

/**
 * @description Retrieves the organization id from the Meraki API
 * @returns {Promise} A promise that resolves with the organization's data
 */
function getOrganizationId() {
    return getApiResponse(organizationUrl)
}

/**
 * @description Extracts device information from the API response
 * @param {Array} result The API response containing the list of devices
 * @returns {Array} An array of devices with their relevant details
 */
function extractDevicesInfo(result) {
    if (!Array.isArray(result) || result.length === 0) {
        console.error('Invalid response format')
        D.failure(D.errorType.PARSING_ERROR)
    }
    const extractedDevices = result.map(function (device) {
        return {
            serial: device.serial,
            name: device.name || 'N/A',
            status: device.status || 'N/A',
            mac: device.mac || 'N/A',
            lanIp: device.lanIp || 'N/A',
            ipType: device.ipType || 'N/A',
            networkId: device.networkId || 'N/A',
            productType: device.productType || 'N/A',
            model: device.model || 'N/A',
            tags: device.tags.length ? device.tags.join(', ') : 'N/A'
        }
    })
    return extractedDevices
}

/**
 * @description Inserts device information into the Domotz table
 * @param {Array} devices The array of devices to insert into the table
 */
function insertDevicesIntoTable(devices) {
    devices.forEach(function (device) {
        table.insertRecord(device.serial, [
            device.name,
            device.status,
            device.mac,
            device.lanIp,
            device.ipType,
            device.networkId,
            device.productType,
            device.model,
            device.tags
        ])
    })
    D.success(table)
}

/**
 * @remote_procedure
 * @label Validate API Access
 * @documentation Validates if the API key and organization ID are correct
 */
function validate() {
    getOrganizationId()
        .then(function(parsedBody) {
            if (!parsedBody || !parsedBody.id) {
                console.error("Invalid response format")
                return D.failure(D.errorType.PARSING_ERROR)
            }
            console.log("Organization ID Verified:", parsedBody.name)
            return D.success()
        })
        .catch(function(err) {
            console.error("Error while verifying organization ID:", err)
            return D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Meraki Device Statuses
 * @documentation Retrieves device statuses from the Meraki API and populates a table in Domotz
 */
function get_status() {
    getDeviceStatuses()
        .then(function (result) {
            const extractedDevices = extractDevicesInfo(result)
            insertDevicesIntoTable(extractedDevices)
        })
        .catch(function (err) {
            console.error(err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}