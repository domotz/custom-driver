/**
 * Domotz Custom Driver
 * Name: Cisco Meraki Channel Utilization
 * Description: This script extracts channel utilization information from Cisco Meraki networks using the Meraki Dashboard API.
 *
 * Communication protocol is HTTPS
 *
 * Tested on Cisco Meraki Dashboard API v1
 *
 * Note: Data is retrieved in 15 minute intervals.
 *
 * Creates a Custom Driver table with the following columns:
 *      - Network: Network name
 *      - Device: Device model
 *      - Channel: Channel id
 *      - Channel Utilization: Percentage of total channel utilization for the given radio
 *      - Wifi Utilization: Percentage of wifi channel utilization for the given radio
 *      - Non Wifi Utilization: Percentage of non-wifi channel utilization for the given radio
 *
 **/

const device = D.createExternalDevice('api.meraki.com')

// The Id of the organization, obtained from the Cisco Meraki dashboard
const organizationId = D.getParameter('organizationID')

// If networkId is 'ALL', it returns all network IDs for the given organization.
// Otherwise, it resolves with the specified networkId
const networkId = D.getParameter('networkID') // The ID of the network

// The API key
const apiKey = D.getParameter('apiKey')

// Table to store channel utilization data
const table = D.createTable(
  'Channel Utilization',
  [
    { label: 'Network', valueType: D.valueType.STRING },
    { label: 'Device', valueType: D.valueType.STRING },
    { label: 'Channel', valueType: D.valueType.STRING },
    { label: 'Channel Utilization', unit: '%', valueType: D.valueType.NUMBER },
    { label: 'Wifi Utilization', unit: '%', valueType: D.valueType.NUMBER },
    { label: 'Non Wifi Utilization', unit: '%', valueType: D.valueType.NUMBER }
  ]
)

/**
 * Function to retrieve network information from the Meraki Dashboard API.
 * @returns {Promise} A promise that resolves with an array of network information.
 */
function getNetworkInfo () {
  const d = D.q.defer()
  const config = {
    url: '/api/v1/organizations/' + organizationId + '/networks',
    protocol: 'https',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    }
  }
  device.http.get(config, function (error, response, body) {
    if (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode === 404) {
      D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode === 401) {
      console.error('Invalid API key')
      D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (response.statusCode !== 200) {
      console.error(body)
      D.failure(D.errorType.GENERIC_ERROR)
    } else {
      const data = JSON.parse(body)
      const networksInfo = []
      if (networkId.toUpperCase() === 'ALL') {
        data.forEach(function (network) {
          networksInfo.push({ id: network.id, name: network.name })
        })
      } else {
        let networkFound = false
        for (let i = 0; i < data.length; i++) {
          if (data[i].id === networkId) {
            networksInfo.push({ id: data[i].id, name: data[i].name })
            networkFound = true
            break
          }
        }
        if (!networkFound) {
          console.error('Network with specified ID not found.')
        }
      }
      d.resolve(networksInfo)
    }
  })
  return d.promise
}

/**
 * Function to retrieve channel utilization data for each network within a 15 minute interval.
 * @param {Array} networksInfo Array of network information.
 * @returns {Promise} A promise that resolves with an array of channel utilization information
 */
function getChannelUtilization (networksInfo) {
  const promises = networksInfo.map(function (network) {
    const d = D.q.defer()
    const timespan = 15 * 60
    const config = {
      url: '/api/v1/networks/' + network.id + '/networkHealth/channelUtilization?timespan=' + timespan,
      protocol: 'https',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      }
    }
    device.http.get(config, function (error, response, body) {
      if (error) {
        console.error(error)
        D.failure(D.errorType.GENERIC_ERROR)
      } else if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
      } else if (response.statusCode === 401) {
        console.error('Invalid API key')
        D.failure(D.errorType.AUTHENTICATION_ERROR)
      } else if (response.statusCode === 400) {
        console.error('Channel utilization data not available for network: ' + network.id + '. Only wireless networks are supported.')
        d.resolve(null)
      } else if (response.statusCode !== 200) {
        D.failure(D.errorType.GENERIC_ERROR)
      } else {
        d.resolve({ id: network.id, name: network.name, body })
      }
    })
    return d.promise
  })
  return D.q.all(promises)
    .then(function (results) {
      return results.filter(function (result) { return result !== null })
    })
}

function sanitize (output) {
  const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

// Function to extract data from the response body and populates custom table
function extractChanelData (data) {
  data.forEach(function (networkData) {
    const name = networkData.name
    const devices = JSON.parse(networkData.body)
    devices.forEach(function (deviceData) {
      for (const key in deviceData) {
        const model = deviceData.model
        if (Array.isArray(deviceData[key])) {
          const channelId = key
          const entry = deviceData[channelId][0]
          const channelUtilization = entry.utilization ? entry.utilization : 0
          const wifiUtilization = entry.wifi ? entry.wifi : 0
          const nonWifiUtilization = entry.non_wifi ? entry.non_wifi : 0
          const recordId = sanitize(name + '-' + model + '-' + channelId)
          table.insertRecord(recordId, [
            name,
            model,
            channelId,
            channelUtilization,
            wifiUtilization,
            nonWifiUtilization
          ])
        }
      }
    })
  })
  D.success(table)
}

/**
 * @remote_procedure
 * @label Validate Cisco Meraki Channel Utilization
 * @documentation This procedure is used to validate the ability to retrieve channel utilization info from Cisco Meraki networks
 */
function validate () {
  getNetworkInfo()
    .then(getChannelUtilization)
    .then(function (response) {
      if (response && response.length > 0) {
        console.log('Validation successful')
        D.success()
      } else {
        console.error('Validation failed')
        D.failure(D.errorType.PARSING_ERROR)
      }
    })
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get Channel Utilization data
 * @documentation This procedure is used to retrieve channel utilization information from Cisco Meraki networks.
 */
function get_status () {
  getNetworkInfo()
    .then(getChannelUtilization)
    .then(extractChanelData)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}
