/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Enclosure Details
 * Description: This script retrieves Enclosure information the IBM FlashSystem 5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns: 
 *      - Status: Indicates whether an enclosure is visible to the SAS network
 *      - Type: The type of enclosure
 *      - Managed: Indicates whether the enclosure is managed
 *      - IO Group ID: The unique identifier for the I/O group that the enclosure is assigned to
 *      - IO Group Name:  The name assigned to the IO group that the enclosure belongs to
 *      - Product MTM: The product machine type and model
 *      - Serial Number: The serial number of the enclosure
 *      - Total Canisters: The maximum number of canisters for this enclosure type
 *      - Online Canisters: The number of canisters that are contained in this enclosure that are online
 *      - Total PSUs: The number of power and cooling units in this enclosure
 *      - Online PSUs: The number of power-supply units (PSUs) contained in this enclosure that are online
 *      - Drive Slots: The number of drive slots in the enclosure
 *      - Total Fan Modules: The total number of fan modules installed in the enclosure
 *      - Online Fan Modules: The number of fan modules that are operational and actively cooling the system
 *      - Total SEMs: The total number of secondary expander modules (SEMs) that are in the system
 *      - Online SEMs: The total number of SEMs in the system that are online
 * 
 **/

var enclosureTable = D.createTable(
  'Enclosure Information',
  [
    {label: "Status", valueType: D.valueType.STRING},
    {label: "Type", valueType: D.valueType.STRING},
    {label: "Managed", valueType: D.valueType.STRING},
    {label: "IO Group ID", valueType: D.valueType.NUMBER},
    {label: "IO Group Name", valueType: D.valueType.STRING},
    {label: "Product MTM", valueType: D.valueType.STRING},
    {label: "Serial Number", valueType: D.valueType.STRING},
    {label: "Total Canisters", valueType: D.valueType.NUMBER},
    {label: "Online Canisters", valueType: D.valueType.NUMBER},
    {label: "Total PSUs", valueType: D.valueType.NUMBER},
    {label: "Online PSUs", valueType: D.valueType.NUMBER},
    {label: "Drive Slots", valueType: D.valueType.NUMBER},
    {label: "Total Fan Modules", valueType: D.valueType.NUMBER},
    {label: "Online Fan Modules", valueType: D.valueType.NUMBER},
    {label: "Total SEMs", valueType: D.valueType.NUMBER},
    {label: "Online SEMs", valueType: D.valueType.NUMBER}
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
 * Retrieves information about enclosure from the IBM FlashSystem5000 using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing enclosure information
 */
function getEnclosure(token) {
  const endpoint = '/rest/lsenclosure'
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': token.token,
  }
  return callHttps(endpoint, headers)
}

/**
 * Populates the enclosure table with the retrieved data from the API
 * @param {Array} data An array of enclosure information objects returned from the API
 */
function populateTable(data) {
  for (let i = 0; i < data.length; i++) {
    const enclosureInfo = data[i]
    enclosureTable.insertRecord(enclosureInfo.id, [
      enclosureInfo.status || 'N/A',
      enclosureInfo.type || 'N/A',
      enclosureInfo.managed || 'N/A',
      enclosureInfo.IO_group_id || 'N/A',
      enclosureInfo.IO_group_name || 'N/A',
      enclosureInfo.product_MTM || 'N/A',
      enclosureInfo.serial_number || 'N/A',
      enclosureInfo.total_canisters || 'N/A',
      enclosureInfo.online_canisters || 'N/A',
      enclosureInfo.total_PSUs || 'N/A',
      enclosureInfo.online_PSUs || 'N/A',
      enclosureInfo.drive_slots || 'N/A',
      enclosureInfo.total_fan_modules || 'N/A',
      enclosureInfo.online_fan_modules || 'N/A',
      enclosureInfo.total_sems || 'N/A',
      enclosureInfo.online_sems || 'N/A'
    ])
  }
  D.success(enclosureTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
    .then(getEnclosure)
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
 * @label Get IBM FlashSystem5000 Enclosure Details
 * @documentation This procedure retrieves Enclosure information for the IBM FlashSystem5000
 */
function get_status() {
  login()
    .then(getEnclosure)
    .then(populateTable)
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}