/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 SAS Ports
 * Description: This script retrieves information about the SAS ports in the IBM FlashSystem 5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns: 
 *    - Port ID: Indicates the port ID
 *    - Port Speed: Indicates the speed of the I/O port 
 *    - Node ID: The ID of the node that contains the port
 *    - Node Name: The name of the node that contains the port
 *    - World Wide Port Name: The worldwide port name
 *    - Status: The status of the port
 *    - Switch WWPN: The WWPN of the switch port if attached to switch, or is blank
 *    - Attachment: Indicates what the port is attached to
 *    - Type: Indicates how the port is configured
 *    - Adapter Location: The location of the adapter that contains the SAS port
 *    - Adapter Port ID: The location of the SAS port that is in the adapter
 * 
 **/

var sasPortsTable = D.createTable(
  'SAS Ports',
  [
    {label: "Port ID", valueType: D.valueType.NUMBER},
    {label: "Port Speed", unit: "GB", valueType: D.valueType.NUMBER},
    {label: "Node ID", valueType: D.valueType.NUMBER},
    {label: "Node Name", valueType: D.valueType.STRING},
    {label: "World Wide Port Name", valueType: D.valueType.STRING},
    {label: "Status", valueType: D.valueType.STRING},
    {label: "Switch WWPN", valueType: D.valueType.STRING},
    {label: "Attachment", valueType: D.valueType.STRING},
    {label: "Type", valueType: D.valueType.STRING},
    {label: "Adapter Location", valueType: D.valueType.NUMBER},
    {label: "Adapter Port ID", valueType: D.valueType.NUMBER}
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
 * Retrieves information about the SAS ports from the IBM FlashSystem5000 using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing SAS port information
 */
function getSASPorts(token) {
  const endpoint = '/rest/lsportsas'
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': token.token,
  }
  return callHttps(endpoint, headers)
}

/**
 * Populates the SAS ports table with the retrieved data from the API
 * @param {Array} data An array of SAS port information objects returned from the API
 */
function populateTable(data) {
  for (let i = 0; i < data.length; i++) {
    const sasPortInfo = data[i]
    sasPortsTable.insertRecord(sasPortInfo.id, [
      sasPortInfo.port_id || 'N/A',
      sasPortInfo.port_speed != 'N/A' ? sasPortInfo.port_speed.replace(/[^0-9.]/g, '') : '0',
      sasPortInfo.node_id || 'N/A',
      sasPortInfo.node_name || 'N/A',
      sasPortInfo.WWPN || 'N/A',
      sasPortInfo.status || 'N/A',
      sasPortInfo.switch_WWPN || 'N/A',
      sasPortInfo.attachment != 'none' ? sasPortInfo.attachment : 'N/A',
      sasPortInfo.type || 'N/A',
      sasPortInfo.adapter_location || 'N/A',
      sasPortInfo.adapter_port_id || 'N/A'
    ])
  }
  D.success(sasPortsTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
    .then(getSASPorts)
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
 * @label Get IBM FlashSystem5000 SAS Ports Information
 * @documentation This procedure retrieves SAS port information for the IBM FlashSystem5000
 */
function get_status() {
  login()
    .then(getSASPorts)
    .then(populateTable)
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}