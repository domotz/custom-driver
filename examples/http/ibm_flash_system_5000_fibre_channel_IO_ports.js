/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Fibre Channel I/O Ports
 * Description: This script retrieves information about the Fibre Channel I/O ports in the IBM FlashSystem 5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns: 
 *    - Fibre Channel I/O Port ID: Unique identifier for the Fibre Channel I/O port
 *    - Port ID: Indicates the platform port ID
 *    - Type: The type of platform port
 *    - Port Speed: Indicates the I/O port speed
 *    - Node ID: The ID of the node containing the port
 *    - Node Name: The name of the node containing the port
 *    - World Wide Port Name: The I/O port worldwide port name
 *    - N-Port ID: Indicates the most recent NPort ID used by the port
 *    - Status: Indicates whether the port is configured to a device of Fibre Channel port
 *    - Attachment: Indicates if the port is attached to an FC switch or directly to an FC host
 *    - Cluster Use: Indicates the node's current capability for local or partner cluster communications
 *    - Adapter Location: The location of the adapter containing the Ethernet port
 *    - Adapter Port ID: The location of the Ethernet port that is in the adapter
 * 
 **/

var fibreChannelIOPortsTable = D.createTable(
  'Fibre Channel I/O Ports',
  [
    {label: "Fibre Channel I/O Port ID", valueType: D.valueType.NUMBER},
    {label: "Port ID", valueType: D.valueType.NUMBER},
    {label: "Type", valueType: D.valueType.STRING},
    {label: "Port Speed", unit: "GB", valueType: D.valueType.NUMBER},
    {label: "Node ID", valueType: D.valueType.NUMBER},
    {label: "Node Name", valueType: D.valueType.STRING},
    {label: "World Wide Port Name", valueType: D.valueType.STRING},
    {label: "N-Port ID", valueType: D.valueType.STRING},
    {label: "Status", valueType: D.valueType.STRING},
    {label: "Attachment", valueType: D.valueType.STRING},
    {label: "Cluster Use", valueType: D.valueType.STRING},
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
 * Retrieves information about the Fibre Channel I/O ports from the IBM FlashSystem5000 using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing Fibre Channel I/O port information
 */
function getFibreChannelIOPorts(token) {
  const endpoint = '/rest/lsportfc'
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': token.token,
  }
  return callHttps(endpoint, headers)
}

/**
 * Populates the Fibre Channel I/O ports table with the retrieved data from the API
 * @param {Array} data An array of Fibre Channel I/O port information objects returned from the API
 */
function populateTable(data) {
  for (let i = 0; i < data.length; i++) {
    const fibreChannelIOPortInfo = data[i]
    fibreChannelIOPortsTable.insertRecord(fibreChannelIOPortInfo.id , [
      fibreChannelIOPortInfo.fc_io_port_id || 'N/A',
      fibreChannelIOPortInfo.port_id || 'N/A',
      fibreChannelIOPortInfo.type || 'N/A',
      fibreChannelIOPortInfo.port_speed != 'N/A' ? fibreChannelIOPortInfo.port_speed.replace(/[^0-9.]/g, '') : '0',
      fibreChannelIOPortInfo.node_id || 'N/A',
      fibreChannelIOPortInfo.node_name || 'N/A',
      fibreChannelIOPortInfo.WWPN || 'N/A',
      fibreChannelIOPortInfo.nportid || 'N/A',
      fibreChannelIOPortInfo.status || 'N/A',
      fibreChannelIOPortInfo.attachment != 'none' ? fibreChannelIOPortInfo.attachment : 'N/A',
      fibreChannelIOPortInfo.cluster_use || 'N/A',
      fibreChannelIOPortInfo.adapter_location || 'N/A',
      fibreChannelIOPortInfo.adapter_port_id || 'N/A'
    ])
  }
  D.success(fibreChannelIOPortsTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
    .then(getFibreChannelIOPorts)
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
 * @label Get IBM FlashSystem5000 Fibre Channel I/O Ports Information
 * @documentation This procedure retrieves Fibre Channel I/O port information for the IBM FlashSystem5000
 */
function get_status() {
  login()
    .then(getFibreChannelIOPorts)
    .then(populateTable)
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}