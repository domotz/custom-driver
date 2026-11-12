/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Physical Drives Information
 * Description: Retrieves information about the physical drives on the IBM FlashSystem5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns:
 *    - Status: Current status of the drive
 *    - Error Sequence Number: Sequence number of any errors related to the drive
 *    - Use: The role of the drive
 *    - Technology Type: Technology type of the drive 
 *    - Capacity: Total storage capacity of the drive
 *    - Managed Disk ID: ID of the Managed Disk the drive belongs to
 *    - Managed Disk Name: Name of the Managed Disk the drive is part of
 *    - Member ID: Identifier for the drive within the Managed Disk
 *    - Enclosure ID: ID of the enclosure containing the drive 
 *    - Slot ID: Slot number within the enclosure where the drive is located
 *    - Node ID: ID of the node associated with the drive
 *    - Node Name: Name of the node associated with the drive
 *    - Auto Manage: Indicates whether the drive is auto-managed
 *    - Drive Class ID: Class identifier for the drive
 *    - Spare Protection: Indicates if spare protection is enabled for the drive
 *    - Balanced: Indicates if the drive is balanced within the array
 *    - Slow Write Count: Number of times the drive had slow writes
 *    - Slow Write Time Last: Timestamp of the last slow write event
 * 
 **/

const endpoints = [
  { endpoint: "lsdrive", key: "id" },
  { endpoint: "lsarraymember", key: "member_id" }
]

let httpResponses = []

const physicalDrivesTable = D.createTable('Physical Drives', [
  { label: "Status", valueType: D.valueType.STRING },
  { label: "Error Sequence Number", valueType: D.valueType.NUMBER },
  { label: "Use", valueType: D.valueType.STRING },
  { label: "Technology Type", valueType: D.valueType.STRING },
  { label: "Capacity", unit: "TB", valueType: D.valueType.NUMBER },
  { label: "Managed Disk ID", valueType: D.valueType.NUMBER },
  { label: "Managed Disk Name", valueType: D.valueType.STRING },
  { label: "Member ID", valueType: D.valueType.NUMBER },
  { label: "Enclosure ID", valueType: D.valueType.STRING },
  { label: "Slot ID", valueType: D.valueType.NUMBER },
  { label: "Node ID", valueType: D.valueType.NUMBER },
  { label: "Node Name", valueType: D.valueType.STRING },
  { label: "Auto Manage", valueType: D.valueType.STRING },
  { label: "Drive Class ID", valueType: D.valueType.NUMBER },
  { label: "Spare Protection", valueType: D.valueType.STRING },
  { label: "Balanced", valueType: D.valueType.STRING },
  { label: "Slow Write Count", valueType: D.valueType.NUMBER },
  { label: "Slow Write Time Last", valueType: D.valueType.STRING }
])

/**
 * Sends an HTTPS POST request and returns the parsed JSON response
 * @param {string} endpoint The API endpoint
 * @param {Object} headers The request headers
 * @returns {Promise} Parsed JSON response
 */
function callHttps(endpoint, headers) {
  const d = D.q.defer();
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
    } else if (response.statusCode === 404) {
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
 * Calls an HTTPS endpoint with an authentication token
 * @param {string} token Auth token for the request
 * @param {string} endpoint The API endpoint
 * @returns {Promise} Parsed JSON response
 */
function callHttpsEndpoint(token, endpoint) {
  const headers = { "X-Auth-Token": token }
  return callHttps(endpoint, headers)
}

/**
 * Logs in using the device's credentials
 * @returns {Promise} A promise that resolves to the parsed JSON login response
 */
function login() {
  const endpoint = "/rest/auth";
  const headers = {
    "Content-Type": "application/json",
    'X-Auth-Username': D.device.username(),
    'X-Auth-Password': D.device.password()
  }
  return callHttps(endpoint, headers)
}

/**
 * Populates the physical drives table with drive information
 * @param {Array} physicalDrives An array of physical drive details
 */
function populateTable(physicalDrives) {
  physicalDrives.forEach(function(drive) {
    physicalDrivesTable.insertRecord(drive.id, [
      drive.status || 'N/A',
      drive.error_sequence_number || 'N/A',
      drive.use || 'N/A',
      drive.tech_type || 'N/A',
      drive.capacity ? drive.capacity.replace(/[^0-9.]/g, '') : 'N/A',
      drive.mdisk_id || 'N/A',
      drive.mdisk_name || 'N/A',
      drive.member_id || 'N/A',
      drive.enclosure_id || 'N/A',
      drive.slot_id || 'N/A',
      drive.node_id || 'N/A',
      drive.node_name || 'N/A',
      drive.auto_manage || 'N/A',
      drive.drive_class_id || 'N/A',
      drive.spare_protection || 'N/A',
      drive.balanced || 'N/A',
      drive.slow_write_count || 'N/A',
      drive.slow_write_time_last || 'N/A'
    ])
  })
}

/**
 * Stores the HTTP response in an array for later processing
 * @param {Object} response The HTTP response object
 * @param {string} key The key to use for merging responses
 */
function storeResponse(response, key) {
  httpResponses.push({ response: response, key: key })
}

/**
 * Merges multiple HTTP responses based on a shared key
 * @returns {Arra} A list of merged response objects
 */
function mergeOutputs() {
  if (httpResponses.length < 2) return []
  let baseResponseList = httpResponses[0].response
  const baseKey = httpResponses[0].key
  for (let i = 1; i < httpResponses.length; i++) {
    const currentResponseList = httpResponses[i].response
    const currentKey = httpResponses[i].key
    baseResponseList = baseResponseList.map(function(baseObject) {
      const matchedObject = currentResponseList.find(function(currentObject) {
        return baseObject[baseKey] === currentObject[currentKey]
      })
      return matchedObject ? Object.assign({}, baseObject, matchedObject) : baseObject
    })
  }
  return baseResponseList
}

/**
 * Retrieves and stores data from specified API endpoints
 * @param {Object} body The body containing the authentication token
 * @returns {Promise} A promise that resolves when all data is retrieved
 */
function retrieveAndStoreData(body) {
  const promises = endpoints.map(function(endpointDetails) {
    return callHttpsEndpoint(body.token, '/rest/' + endpointDetails.endpoint)
      .then(function(response) {
        storeResponse(response, endpointDetails.key)
        return response
      })
  })
  return D.q.all(promises)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
  login()
    .then(retrieveAndStoreData)
    .then(function(response) {
      if (!response || !Array.isArray(response) || response.length === 0) {
        console.error('No data found')
      }
      console.log('Validation successful')
      D.success()
    })
    .catch(function(error) {
      console.error('Validation failed: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 Physical Drives Information
 * @documentation This procedure retrieves the Physical Drives Information of the IBM FlashSystem5000
 */
function get_status() {
  login()
    .then(retrieveAndStoreData)
    .then(mergeOutputs)
    .then(function (physicalDrives) {
      populateTable(physicalDrives)
      D.success(physicalDrivesTable)
  })
    .catch(function(error) {
      console.error('Failed to retrieve status: ', error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}
