/**
 * Domotz Custom Driver 
 * Name: Dante Director - Device Status Monitoring
 * Description: This script integrates with the Dante Managed API to fetch and monitor device statuses
 * It retrieves detailed information about each device, including connectivity, clocking, latency, and subscription status,
 * as well as detailed channel information
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with Dante Director using the Dante Managed API 
 *
  * Creates a Custom Driver Table with the following columns:
 *      - Name: The name of the device
 *      - Manufacturer Name: The name of the manufacturer of the device
 *      - Product Model: The model name of the device
 *      - Dante Version: The version of Dante software running on the device 
 *      - Address: The network address of the device
 *      - Status ID: Identifier representing the current status of the device.
 *      - Clocking Status: Indicates the clocking status of the device
 *      - Latency Status: The latency status for the device.
 *      - Connectivity Status: The current connectivity status of the device
 *      - Subscription Status: The subscription status of the device
 *      - RX Channels: List of RX channels associated with the device
 *      - TX Channels: List of TX channels associated with the device
 *      - Alert Message Clocking: Alert message related to clocking issues
 *      - Alert Message Connectivity: Alert message related to connectivity issues
 *      - Alert Message Latency: Alert message related to latency issues
 *      - Alert Message Subscriptions: Alert message related to subscription issues
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
    {label: 'Manufacturer Name', valueType: D.valueType.STRING },
    {label: 'Product Model', valueType: D.valueType.STRING },
    {label: 'Dante Version', valueType: D.valueType.STRING },
    {label: 'Address', valueType: D.valueType.STRING },
    {label: 'Status ID', valueType: D.valueType.STRING },
    {label: 'Clocking Status', valueType: D.valueType.STRING },
    {label: 'Latency Status', valueType: D.valueType.STRING },
    {label: 'Connectivity Status', valueType: D.valueType.STRING },
    {label: 'Subscription Status', valueType: D.valueType.STRING },
    {label: 'RX Channels', valueType: D.valueType.STRING },
    {label: 'TX Channels', valueType: D.valueType.STRING },
    {label: 'Alert Message Clocking', valueType: D.valueType.STRING },
    {label: 'Alert Message Connectivity', valueType: D.valueType.STRING },
    {label: 'Alert Message Latency', valueType: D.valueType.STRING },
    {label: 'Alert Message Subscriptions', valueType: D.valueType.STRING }
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
             'devices { id name identity { manufacturerName productModelName danteVersion } interfaces { address } status { id clocking latency connectivity subscriptions alertMessage { clocking connectivity latency subscriptions }}' +
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
      var manufacturerName = device.identity && device.identity.manufacturerName ? device.identity.manufacturerName: 'N/A'
      var productModelName = device.identity && device.identity.productModelName ? device.identity.productModelName: 'N/A'
      var danteVersion = device.identity && device.identity.danteVersion ? device.identity.danteVersion: 'N/A'
      var address = (device.interfaces && Array.isArray(device.interfaces) && device.interfaces.length > 0)
      ? device.interfaces[0].address
      : 'N/A'
      var statusId = device.status && device.status.id ? device.status.id : 'N/A'
      var clockingStatus = device.status && device.status.clocking ? device.status.clocking : 'N/A'
      var latencyStatus = device.status && device.status.latency ? device.status.latency : 'N/A'
      var connectivityStatus = device.status && device.status.connectivity ? device.status.connectivity : 'N/A'
      var subscriptionStatus = device.status && device.status.subscriptions ? device.status.subscriptions : 'N/A'
      var rxChannels = (device.rxChannels && Array.isArray(device.rxChannels) && device.rxChannels.length > 0)
        ? device.rxChannels.map(function(channel) { return channel.name + " (" + (channel.status || 'N/A') + ")" }).join(", ")
        : 'N/A'
      var txChannels = (device.txChannels && Array.isArray(device.txChannels) && device.txChannels.length > 0)
        ? device.txChannels.map(function(channel) { return channel.name }).join(", ")
        : 'N/A'
      var alertMessageClocking = device.status && device.status.alertMessage && device.status.alertMessage.clocking ? device.status.alertMessage.clocking : 'N/A'
      var alertMessageConnectivity = device.status && device.status.alertMessage && device.status.alertMessage.connectivity ? device.status.alertMessage.connectivity : 'N/A'
      var alertMessageLatency = device.status && device.status.alertMessage && device.status.alertMessage.latency ? device.status.alertMessage.latency : 'N/A'
      var alertMessageSubscriptions = device.status && device.status.alertMessage && device.status.alertMessage.subscriptions ? device.status.alertMessage.subscriptions : 'N/A'
      populateTable({
        id: device.id,
        name: device.name || 'N/A',
        manufacturerName: manufacturerName,
        productModelName: productModelName,
        danteVersion: danteVersion,
        address: address,
        statusId: statusId,
        clockingStatus: clockingStatus,
        latencyStatus: latencyStatus,
        connectivityStatus: connectivityStatus,
        subscriptionStatus: subscriptionStatus,      
        rxChannels: rxChannels,
        txChannels: txChannels,
        alertMessageClocking: alertMessageClocking,
        alertMessageConnectivity: alertMessageConnectivity,
        alertMessageLatency: alertMessageLatency,
        alertMessageSubscriptions: alertMessageSubscriptions,
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
      devicesInfo.manufacturerName,
      devicesInfo.productModelName,
      devicesInfo.danteVersion,
      devicesInfo.address,
      devicesInfo.statusId,
      devicesInfo.clockingStatus,
      devicesInfo.latencyStatus,
      devicesInfo.connectivityStatus,
      devicesInfo.subscriptionStatus,
      devicesInfo.rxChannels,
      devicesInfo.txChannels,
      devicesInfo.alertMessageClocking,
      devicesInfo.alertMessageConnectivity,
      devicesInfo.alertMessageLatency,
      devicesInfo.alertMessageSubscriptions,
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