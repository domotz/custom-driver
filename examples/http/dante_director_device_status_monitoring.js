/**
 * Domotz Custom Driver 
 * Name: Dante Director - Device Status Monitoring
 * Description: This script integrates with the Dante Managed API to fetch and monitor device statuses
 * It retrieves detailed information about each device, including connectivity status, subscription status and channel information
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with Dante Director using the Dante Managed API 
 *
  * Creates a Custom Driver Table with the following columns:
 *      - Name: The name of the device.
 *      - Connectivity Status: The current connectivity status of the device
 *      - Subscription Status: The subscription status of the device
 *      - RX Channels: List of RX channels associated with the device
 *      - TX Channels: List of TX channels associated with the device
 * 
 **/

// The identifier for the domain whose devices you want to monitor
// Provide the domainID from the Dante Director URL
var domainID = D.getParameter('domainID')

// The API key used for authentication with the Dante API
var apiKey = D.getParameter('apiKey')

// The base URL for the Dante Managed API. 
// This is the endpoint used to interact with the Dante API for device status monitoring and management.
var danteHost = 'api.director.dante.cloud'

//Custom Driver table to store
var table = D.createTable(
  'Devices', [
    {label: 'Name', valueType: D.valueType.STRING },
    {label: 'Connectivity Status', valueType: D.valueType.STRING },
    {label: 'Subscription Status', valueType: D.valueType.STRING },
    {label: 'RX Channels', valueType: D.valueType.STRING },
    {label: 'TX Channels', valueType: D.valueType.STRING }
  ]
)

/**
 * Fetches device information from the Dante API
 * @returns {Promise} A promise that resolves with the device data or rejects with an error
 */
function getDevicesInfo() {
  var d = D.q.defer()
	var device = D.createExternalDevice(danteHost)
  var config = {
    url: '/graphql',
    protocol: 'https',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey
    },
    body: JSON.stringify({
      query: 'query Devices($domainId: ID!) { ' +
             'domain(id: $domainId) { ' +
             'devices { id name status { connectivity subscriptions } ' +
             'rxChannels { id index name subscribedDevice subscribedChannel status } ' +
             'txChannels { id index name } ' +
             '} } }',
      variables: { domainId: domainID }
    })
  }
  device.http.post(config, function (error, response, body) {
    if (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode != 200) {
      D.failure(D.errorType.GENERIC_ERROR);
    } else {
      var parsedResponse = JSON.parse(body)
      if (parsedResponse.errors && parsedResponse.errors.length > 0){
        var errorMessage = parsedResponse.errors[0].message
        if (errorMessage === 'Unauthenticated user or user not found') {
          D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (errorMessage === 'ID or Name must be defined'){
          console.error('Missing ID')
          D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        }
      } else if (parsedResponse.data) {
        if (parsedResponse.data.domain === null) {
          console.error('Domain ID is invalid')
          D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else {
          d.resolve(parsedResponse.data.domain)
        }
      }
    }
  })
  return d.promise
}

/**
 * Processes the device data and populates the custom table
 * @param {Object} data The data containing device information
 */
function extractData(data) {
  if (data && Array.isArray(data.devices)) {
    var devices = data.devices
    for (var i = 0; i < devices.length; i++) {
      var device = devices[i]
      var rxChannels = (device.rxChannels && Array.isArray(device.rxChannels) && device.rxChannels.length > 0)
        ? device.rxChannels.map(function(channel) { return channel.name + " (" + (channel.status || 'N/A') + ")" }).join(", ")
        : 'N/A'
      var txChannels = (device.txChannels && Array.isArray(device.txChannels) && device.txChannels.length > 0)
        ? device.txChannels.map(function(channel) { return channel.name }).join(", ")
        : 'N/A'
      var connectivityStatus = device.status && device.status.connectivity ? device.status.connectivity : 'N/A'
      var subscriptionStatus = device.status && device.status.subscriptions ? device.status.subscriptions : 'N/A'
      populateTable({
        id: device.id || 'N/A',
        name: device.name || 'N/A',
        connectivityStatus: connectivityStatus,
        subscriptionStatus: subscriptionStatus,
        rxChannels: rxChannels,
        txChannels: txChannels
      })
    }
    D.success(table)
  } else {
    console.error('No devices found in data')
    D.failure(D.errorType.PARSING_ERROR)
  }
}

function sanitize(output){
  var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
  var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
  return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * Populates the table with retrieved data
 * @param {Object} devicesInfo The device information to insert into the table
 */
function populateTable(devicesInfo) {
  table.insertRecord(
    sanitize(devicesInfo.id), [
      devicesInfo.name,
      devicesInfo.connectivityStatus,
      devicesInfo.subscriptionStatus,
      devicesInfo.rxChannels,
      devicesInfo.txChannels
    ]
  )
}

/**
 * @remote_procedure
 * @label Validate Dante Devices
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
  getDevicesInfo()
    .then(function (response) {
      if (response && Array.isArray(response.devices) && response.devices.length > 0) {
        console.log('Devices information successfully retrieved')
        D.success()
      } else {
        console.error('No devices found in data')
        D.failure(D.errorType.PARSING_ERROR)
      }     
    })
    .catch(function (err) {
        console.error(err)
        D.failure(D.errorType.GENERIC_ERROR)
    });
}

/**
 * @remote_procedure
 * @label Get Device Status
 * @documentation This procedure fetches device information and populates the custom table with the retrieved data
 */
function get_status() {
  getDevicesInfo()
    .then(extractData)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}