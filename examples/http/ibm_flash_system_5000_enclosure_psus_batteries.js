/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Enclosure PSUs Batteries Information
 * Description: This script retrieves information about the batteries within the enclosure Power Supply Units (PSUs) of the IBM FlashSystem5000.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns:
 *    - Enclosure ID: Unique identifier for each enclosure
 *    - Battery ID: Unique identifier for each battery
 *    - Status: Operational status of the battery
 *    - Charging Status: Current charging state of the battery
 *    - Recondition Needed: Indicates if the battery requires reconditioning
 *    - Percent Charged: Current battery charge level as a percentage
 *    - End of Life Warning: Alerts if the battery is nearing the end of its usable life
 *    - Canister ID: Identifier for the canister associated with the battery
 *    - Battery Slot: Specifies the slot number of the battery within the enclosure
 * 
 **/

var batteryTable = D.createTable(
  'Battery Information',
  [
    {label: "Enclosure ID", valueType: D.valueType.NUMBER},
    {label: "Battery ID", valueType: D.valueType.NUMBER},
    {label: "Status", valueType: D.valueType.STRING},
    {label: "Charging Status", valueType: D.valueType.STRING},
    {label: "Recondition Needed", valueType: D.valueType.STRING},
    {label: "Percent Charged", unit: "%", valueType: D.valueType.NUMBER},
    {label: "End of Life Warning", valueType: D.valueType.STRING},
    {label: "Canister ID", valueType: D.valueType.NUMBER},
    {label: "Battery Slot", valueType: D.valueType.NUMBER}
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
 * Retrieves information about the enclosure's battery status using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing battery information
 */
function getEnclosureBatteryInfo(token) {
  const endpoint = '/rest/lsenclosurebattery'
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': token.token,
  }
  return callHttps(endpoint, headers)
}

/**
 * Populates the battery information table with the retrieved data
 * @param {Array} data An array of battery information objects returned from the API
 */
function populateTable(data) {
  for (let i = 0; i < data.length; i++) {
    const batteriesInfo = data[i]
    batteryTable.insertRecord((i+1).toString() , [
      batteriesInfo.enclosure_id,
      batteriesInfo.battery_id,
      batteriesInfo.status,
      batteriesInfo.charging_status,
      batteriesInfo.recondition_needed,
      batteriesInfo.percent_charged,
      batteriesInfo.end_of_life_warning,
      batteriesInfo.canister_id,
      batteriesInfo.battery_slot
    ])
  }
  D.success(batteryTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
    .then(getEnclosureBatteryInfo)
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
 * @label Get IBM FlashSystem5000 Enclosure PSUs Batteries Information
 * @documentation This procedure retrieves the battery information within the enclosure PSUs of the IBM FlashSystem5000
 */
function get_status() {
  login()
    .then(getEnclosureBatteryInfo)
    .then(populateTable)
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}