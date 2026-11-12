/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Updates
 * Description: This script retrieves information about the system, enclosure, and drive updates from the IBM FlashSystem 5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates Custom Driver variables:
 *    - Status: The overall update-related status of the system
 *    - Event Sequence Number: Indicates an event that describes any current problem with the code update
 *    - Progress: Indicates the completion percentage of the current update activity
 *    - Estimated Completion Time: Indicates estimated completion time of current update activity
 *    - Suggested Action: The actions that help the update progress.
 *    - System New Code Level: Indicates that a new level of code is being updated
 *    - System Forced: Indicates any current node-related activity in forced mode
 *    - System Next Node Status: Indicates the status of the next node in the current node-related update activity
 *    - System Next Node Time: Indicates the time that the next node update will start
 *    - System Next Node ID: The ID of the next node in the current node-related update
 *    - System Next Node Name: The name of the next node in the current node-related update
 *    - System Next Pause Time: Time for the next pause in the update process 
 * 
 **/

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
 * Retrieves update-related information from the IBM FlashSystem5000 using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing update information
 */
function getUpdateInfo(token) {
  const endpoint = '/rest/lsupdate'
  const headers = {
    'Content-Type': 'application/json',
    'X-Auth-Token': token.token,
  }
  return callHttps(endpoint, headers)
}

function getDisplayValue(value) {
  return (value === undefined || value === 'none' || value === null || value === '') ? 'N/A' : value
}

/**
 * Formats a date into a string in the format 'MM-DD-YYYY HH:mm:ss'
 * @param {String} timestamp The date 
 * @returns {string} The formatted date string
 */
function formatDate(timestamp) {
  if (!timestamp) return 'N/A';
  const year = parseInt('20' + timestamp.slice(0, 2))
  const month = parseInt(timestamp.slice(2, 4)) - 1
  const day = parseInt(timestamp.slice(4, 6))
  const hour = parseInt(timestamp.slice(6, 8))
  const minute = parseInt(timestamp.slice(8, 10))
  const second = parseInt(timestamp.slice(10, 12))
  const dateTime = new Date(year, month, day, hour, minute, second)
  return (dateTime.getMonth() + 1) + '-' + dateTime.getDate() + '-' + dateTime.getFullYear() + ' ' + dateTime.getHours() + ':' + dateTime.getMinutes() + ':' + dateTime.getSeconds()
}

/**
 * Extracts relevant variables from the data response 
 * @param {Object} data The data response from the API
 */
function extarctVariables(data) {
  if (data && Object.keys(data).length > 0) {
    var variables = [
      D.createVariable('status', 'Status', getDisplayValue(data.status), null, D.valueType.STRING),
      D.createVariable('event_sequence_number', 'Event Sequence Number', getDisplayValue(data.event_sequence_number), null, D.valueType.NUMBER),
      D.createVariable('progress', 'Progress', getDisplayValue(data.progress), '%', D.valueType.NUMBER),
      D.createVariable('estimated_completion_time', 'Estimated Completion Time', formatDate(data.estimated_completion_time), null, D.valueType.DATETIME),
      D.createVariable('suggested_action', 'Suggested Action', getDisplayValue(data.suggested_action), null, D.valueType.STRING),
      D.createVariable('system_new_code_level', 'System New Code Level', getDisplayValue(data.system_new_code_level), null, D.valueType.STRING),
      D.createVariable('system_forced', 'System Forced', getDisplayValue(data.system_forced), null, D.valueType.STRING),
      D.createVariable('system_next_node_status', 'System Next Node Status', getDisplayValue(data.system_next_node_status), null, D.valueType.STRING),
      D.createVariable('system_next_node_time', 'System Next Node Time', formatDate(data.system_next_node_time), null, D.valueType.DATETIME),
      D.createVariable('system_next_node_id', 'System Next Node ID', getDisplayValue(data.system_next_node_id), null, D.valueType.NUMBER),
      D.createVariable('system_next_node_name', 'System Next Node Name', getDisplayValue(data.system_next_node_name), null, D.valueType.STRING),
      D.createVariable('system_next_pause_time', 'System Next Pause Time', formatDate(data.system_next_pause_time), null, D.valueType.DATETIME)
    ]
    D.success(variables)
  } else {
    console.error('No data found')
    D.failure(D.errorType.PARSING_ERROR)
  }
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
    .then(getUpdateInfo)
    .then(function(response) {
      if (response && Object.keys(response).length > 0) {
        console.log('Validation successful')
        D.success()
      } else {
        console.error('Validation failed: No data found')
        D.failure(D.errorType.PARSING_ERROR)
      }
    })
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 Update Details
 * @documentation This procedure retrieves update information for the IBM FlashSystem5000
 */
function get_status() {
  login()
    .then(getUpdateInfo)
    .then(extarctVariables)
    .catch(function (error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}