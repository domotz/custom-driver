/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 USB Ports Used
 * Description: This script retrieves information about the USB ports used in the IBM FlashSystem5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns:
 *      - Node ID: Unique identifier for the node
 *      - Node Name: The name of the node where the port is located
 *      - Node Side: Physical side of the node
 *      - Port ID: Unique identifier for the USB port
 *      - Status: Current operational status of the USB port
 *      - Encryption State: Indicates if data is encrypted or not
 *      - Service state: Shows if the USB port service is online or offline
 * 
 **/

var usbPortUsedTable = D.createTable(
  'USB Ports Information',
  [
    {label: "Node ID", valueType: D.valueType.NUMBER},
    {label: "Node Name", valueType: D.valueType.STRING},
    {label: "Node Side", valueType: D.valueType.STRING},
    {label: "Port ID", valueType: D.valueType.NUMBER},
    {label: "Status", valueType: D.valueType.STRING},
    {label: "Encryption State", valueType: D.valueType.STRING},
    {label: "Service state", valueType: D.valueType.STRING}
  ]
)

/**
 * Sends an HTTPS POST request and returns the parsed JSON response
 * @param {string} endpoint The API endpoint
 * @param {Object} headers The request headers
 * @returns {Promise} Parsed JSON response
 */
function callHttps(endpoint, headers) {
  const d = D.q.defer()
  const config = {
    url: endpoint,
    protocol: "https",
    port: 7443,
    rejectUnauthorized: false,
    headers: headers
  }
  D.device.http.post(config, function (error, response, body) {
    if (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    } else if (!response || response.statusCode === 404) {
      D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode === 403) {
      D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (response.statusCode !== 200) {
      D.failure(D.errorType.GENERIC_ERROR)
    } else {
      d.resolve(JSON.parse(body))
    }
  })
  return d.promise
}

/**
 * Logs in using the device's credentials
 * @returns {Promise} A promise that resolves to the parsed JSON login response
 */
function login() {
  const endpoint = '/rest/auth'
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Username': D.device.username(),
    'X-Auth-Password': D.device.password()
  }
  return callHttps(endpoint, headers)
}

/**
 * Retrieves information about the USB ports used in the IBM FlashSystem5000 using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing USB port information
 */
function getUSPPortsUsedInfo(token) {
  const endpoint = '/rest/lsportusb'
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': token.token,
  }
  return callHttps(endpoint, headers)
}

/**
 * Populates the USB ports information table with the retrieved data
 * @param {Array} data An array of USB port information objects returned from the API
 */
function populateTable(data) {
  for (let i = 0; i < data.length; i++) {
    const usbPortUsedInfo = data[i]
    usbPortUsedTable.insertRecord(usbPortUsedInfo.id , [
      usbPortUsedInfo.node_id || 'N/A',
      usbPortUsedInfo.node_name || 'N/A',
      usbPortUsedInfo.node_side || 'N/A',
      usbPortUsedInfo.port_id || 'N/A',
      usbPortUsedInfo.status || 'N/A',
      usbPortUsedInfo.encryption_state || 'N/A',
      usbPortUsedInfo.service_state || 'N/A'
    ])
  }
  D.success(usbPortUsedTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
    .then(getUSPPortsUsedInfo)
    .then(function(response) {
      if (!response || !Array.isArray(response) || response.length === 0) {
        console.error('Validation failed: No data found')
        D.failure(D.errorType.PARSING_ERROR)
      }
      console.log('Validation successful')
      D.success()
    })
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 USB Ports Information
 * @documentation This procedure retrieves the USB port information for the IBM FlashSystem5000
 */
function get_status() {
  login()
    .then(getUSPPortsUsedInfo)
    .then(populateTable)
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}