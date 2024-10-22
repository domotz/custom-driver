/**
 * Domotz Custom Driver
 * Name: Azure Networ Interfaces
 * Description: This script retrieves information about network interfaces and their associated performance metrics
 *
 * Communication protocol is HTTPS
 *
 * Creates Custom Driver table with the following columns:
 *      - Resource Group
 *      - Provisioning State
 *      - Resource GUID
 *      - IP Configuration Name
 *      - IP Config Provisioning State
 *      - Private IP Address
 *      - IP Allocation Method
 *      - Primary IP Configuration
 *      - Private IP Version
 *      - DNS servers
 *      - Applied DNS servers
 *      - Internal Domain Name Suffix
 *      - MAC Address
 *      - Accelerated Networking
 *      - Virtual Network Encryption
 *      - IP Forwarding
 *      - Disable TCP State Tracking
 *      - Network Security Group
 *      - Primary Network Interface
 *      - Associated Virtual Machine
 *      - NIC Type
 *      - Location
 *      - Kind
 *      - Bytes Sent
 *      - Bytes Received
 *      - Packets Sent
 *      - Packets Received
 * 
 **/

const tenantId = D.getParameter('tenantId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')
const subscriptionId = D.getParameter('subscriptionId')

const resourceGroups = D.getParameter('resourceGroups')
const vmNames = D.getParameter('vmNames')

// Define external devices for Azure login and management services
const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com')
const azureCloudManagementService = D.createExternalDevice('management.azure.com')

let accessToken

// Table to store network interface information
const networkInterfacesTable = D.createTable(
  'Network Interfaces',
  [
    { label: 'Resource Group', valueType: D.valueType.STRING },
    { label: 'Provisioning State', valueType: D.valueType.STRING },
    { label: 'Resource GUID', valueType: D.valueType.STRING },
    { label: 'IP Configuration Name', valueType: D.valueType.STRING },
    { label: 'IP Config Provisioning State', valueType: D.valueType.STRING },
    { label: 'Private IP Address', valueType: D.valueType.STRING },
    { label: 'IP Allocation Method', valueType: D.valueType.STRING },
    { label: 'Primary IP Configuration', valueType: D.valueType.STRING },
    { label: 'Private IP Version', valueType: D.valueType.STRING },
    { label: 'DNS servers', valueType: D.valueType.STRING },
    { label: 'Applied DNS servers', valueType: D.valueType.STRING },
    { label: 'Internal Domain Name Suffix', valueType: D.valueType.STRING },
    { label: 'MAC Address', valueType: D.valueType.STRING },
    { label: 'Accelerated Networking', valueType: D.valueType.STRING },
    { label: 'Virtual Network Encryption', valueType: D.valueType.STRING },
    { label: 'IP Forwarding', valueType: D.valueType.STRING },
    { label: 'Disable TCP State Tracking', valueType: D.valueType.STRING },
    { label: 'Network Security Group', valueType: D.valueType.STRING },
    { label: 'Primary Network Interface', valueType: D.valueType.STRING },
    { label: 'Associated Virtual Machine', valueType: D.valueType.STRING },
    { label: 'NIC Type', valueType: D.valueType.STRING },
    { label: 'Location', valueType: D.valueType.STRING },
    { label: 'Kind', valueType: D.valueType.STRING },
    { label: 'Bytes Sent', unit: "B", valueType: D.valueType.STRING },
    { label: 'Bytes Received', unit: "B", valueType: D.valueType.STRING },
    { label: 'Packets Sent', unit: "B", valueType: D.valueType.STRING },
    { label: 'Packets Received', unit: "B", valueType: D.valueType.STRING }
  ]
)

// Performance metrics to retrieve from Azure
// This array contains the names of specific performance metrics related to network interfaces 
const performanceMetrics = [
  "BytesSentRate",
  "BytesReceivedRate",
  "PacketsSentRate",
  "PacketsReceivedRate"
]

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures
 * @param {Object} error The error object returned from the HTTP request
 * @param {Object} response The HTTP response object
 */
function checkHTTPError(error, response) {
  if (error) {
    console.error(error)
    D.failure(D.errorType.GENERIC_ERROR)
  } else if (response.statusCode === 404) {
    D.failure(D.errorType.RESOURCE_UNAVAILABLE)
  } else if (response.statusCode === 401 || response.statusCode === 403) {
    D.failure(D.errorType.AUTHENTICATION_ERROR)
  } else if (response.statusCode !== 200) {
    D.failure(D.errorType.GENERIC_ERROR)
  }
}

/**
 * Processes the login response, extracting the access token
 * @param {Object} d The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processLoginResponse(d) {
  return function process(error, response, body) {
    checkHTTPError(error, response)
    const bodyAsJSON = JSON.parse(body)
    if (bodyAsJSON.access_token) {
      accessToken = bodyAsJSON.access_token
      d.resolve()
    } else {
      console.error("Access token not found in response body")
      D.failure(D.errorType.AUTHENTICATION_ERROR)
    }
  }
}

/**
 * Filters the network interfaces based on the provided VM names and resource groups
 * @param {Array} networkInterfaces The list of network interfaces to filter
 * @returns {Array} The filtered list of network interfaces
 */
function filterNetworkInterfaces(networkInterfaces) {
  return networkInterfaces.filter(function(networkInterface) {
    const associatedVM = networkInterface.associatedVrtualMachine
    const resourceGroupName = networkInterface.resourceGroupName
    const vmFilter = (vmNames.length === 1 && vmNames[0].toLowerCase() === 'all') || vmNames.some(function(vmName) { return vmName.toLowerCase() === associatedVM.toLowerCase() })
    const rgFilter = (resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') || resourceGroups.some(function(resourceGroup) { return resourceGroup.toLowerCase() === resourceGroupName.toLowerCase()})
    return vmFilter && rgFilter
  })
}

/**
 * Processes the response containing network interfaces, filtering and resolving the data
 * @param {Object} d The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processNetworkInterfacesResponse(d) {
  return function process(error, response, body) {
    checkHTTPError(error, response)
    const bodyAsJSON = JSON.parse(body)
    if (Array.isArray(bodyAsJSON.value) && bodyAsJSON.value.length > 0) {
      const networkInterfaces = bodyAsJSON.value.map(extracNetworkInterfacesInfo)
      const filteredInterfaces = filterNetworkInterfaces(networkInterfaces)
      d.resolve(filteredInterfaces)
    } else {
      console.error("No Network Interfaces found")
      D.failure(D.errorType.GENERIC_ERROR)
    }
  }
}

/**
 * Processes the performance metrics response for a network interface
 * @param {Object} d  The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processNIPerformanceMetricsResponse(d) {
  return function process(error, response, body) {
    checkHTTPError(error, response);
    const bodyAsJSON = JSON.parse(body)
    if (Array.isArray(bodyAsJSON.value) && bodyAsJSON.value.length > 0) {
      const metricsData = extractMetricsInfo(bodyAsJSON)
      d.resolve(metricsData)
    } else {
      console.error("No performance metrics found for the network interface")
      D.failure(D.errorType.GENERIC_ERROR)
    }
  }
}

/**
 * Logs in to Azure cloud service
 * @returns A promise that resolves on successful login
 */
function login() {
  const d = D.q.defer()
  const config = {
    url: "/" + tenantId + "/oauth2/token", 
    protocol: "https", 
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    }, 
    form: {
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      resource: "https://management.azure.com\/"
    }, 
    rejectUnauthorized: false, 
    jar: true
  }
  azureCloudLoginService.http.post(config, processLoginResponse(d))
  return d.promise
}

/**
 * Extracts information from a network interface object
 * @param {Object} networkInterface  The network interface object to extract data from
 * @returns {Object} An object containing extracted network interface information
 */
function extracNetworkInterfacesInfo(networkInterface) {
  let resourceGroupName = 'N/A'
  if (networkInterface.id) {
    const matches = networkInterface.id.match(/resourceGroups\/([^/]+)/)
    resourceGroupName = matches ? matches[1] : 'N/A'
  } else {
    resourceGroupName = 'N/A'
  }
  const properties = networkInterface.properties || {}
  const ipConfigurations = properties.ipConfigurations || []
  const ipConfig = ipConfigurations.length > 0 ? ipConfigurations[0] : {}
  const ipConfigProperties = ipConfig.properties || {}
  const dnsSettings = properties.dnsSettings || {}
  let networkSecurityGroup = 'N/A'
  if (properties.networkSecurityGroup && properties.networkSecurityGroup.id) {
    const matches = properties.networkSecurityGroup.id.match(/networkSecurityGroups\/([^/]+)/)
    networkSecurityGroup = matches ? matches[1] : 'N/A'
  }
  let associatedVrtualMachine = 'N/A'
  if (properties.virtualMachine && properties.virtualMachine.id) {
    const matches = properties.virtualMachine.id.match(/virtualMachines\/([^/]+)/)
    associatedVrtualMachine = matches ? matches[1] : 'N/A'
  }
  return {
    name: networkInterface.name || 'N/A', 
    resourceGroupName, 
    provisioningState: properties.provisioningState || 'N/A', 
    resourceGuid: properties.resourceGuid || 'N/A', 
    ipConfigurationName: ipConfig.name || 'N/A', 
    ipConfigProvisioningState: ipConfigProperties.provisioningState || 'N/A', 
    privateIPAddress: ipConfigProperties.privateIPAddress || 'N/A', 
    privateIPAllocationMethod: ipConfigProperties.privateIPAllocationMethod || 'N/A',
    primaryIpConfiguration: ipConfigProperties.primary || 'N/A',
    privateIPAddressVersion: ipConfigProperties.privateIPAddressVersion || 'N/A',
    dnsServers: Array.isArray(dnsSettings.dnsServers) && dnsSettings.dnsServers.length > 0 ? dnsSettings.dnsServers.join(', ') : 'N/A',
    appliedDnsServers: Array.isArray(dnsSettings.appliedDnsServers) && dnsSettings.appliedDnsServers.length > 0 ? dnsSettings.appliedDnsServers.join(', ') : 'N/A',
    internalDomainNameSuffix: dnsSettings.internalDomainNameSuffix || 'N/A',
    macAddress: properties.macAddress || 'N/A',
    enableAcceleratedNetworking: properties.enableAcceleratedNetworking || 'N/A',
    vnetEncryptionSupported: properties.vnetEncryptionSupported || 'N/A',
    enableIPForwarding: properties.enableIPForwarding || 'N/A',
    disableTcpStateTracking: properties.disableTcpStateTracking || 'N/A',
    networkSecurityGroup,
    primaryNetworkInterface: properties.primary || 'N/A',
    associatedVrtualMachine,
    nicType: properties.nicType || 'N/A',
    location: networkInterface.location || 'N/A',
    kind: networkInterface.kind || 'N/A'
  }
}

/**
 * Extracts metrics information from the performance metrics response
 * @param {Object} metricsResponse  The response object containing performance metrics
 * @returns {Object} An object mapping metric names to their latest values
 */
function extractMetricsInfo(metricsResponse) {
  const metricsInfo = {}
  metricsResponse.value.forEach(function(metric) {
    const metricName = metric.name.value
    const timeseries = metric.timeseries || []
    if (timeseries.length > 0) {
      const latestData = timeseries[0].data
      const latestValue = latestData[latestData.length - 1]
      metricsInfo[metricName] = latestValue ? latestValue.total : 'N/A'
    } else {
      metricsInfo[metricName] = 'N/A'
    }
  })
  return metricsInfo
}

/**
 * Inserts records into the network interfaces table with associated metrics
 * @param {Array} networkInterfaces  The list of network interfaces to insert
 * @param {Array} metricsList  The list of performance metrics corresponding to the network interfaces
 */
function insertRecord(networkInterfaces, metricsList) {
  networkInterfaces.forEach(function(network, index) {
    const metricsData = metricsList[index] || {}
    networkInterfacesTable.insertRecord(network.name, [
      network.resourceGroupName,
      network.provisioningState,
      network.resourceGuid,
      network.ipConfigurationName,
      network.ipConfigProvisioningState,
      network.privateIPAddress,
      network.privateIPAllocationMethod,
      network.primaryIpConfiguration,
      network.privateIPAddressVersion,
      network.dnsServers,
      network.appliedDnsServers,
      network.internalDomainNameSuffix,
      network.macAddress,
      network.enableAcceleratedNetworking,
      network.vnetEncryptionSupported,
      network.enableIPForwarding,
      network.disableTcpStateTracking,
      network.networkSecurityGroup,
      network.primaryNetworkInterface,
      network.associatedVrtualMachine,
      network.nicType,
      network.location,
      network.kind,
      metricsData.BytesSentRate || 'N/A',
      metricsData.BytesReceivedRate || 'N/A',
      metricsData.PacketsSentRate || 'N/A',
      metricsData.PacketsReceivedRate || 'N/A'
    ])
  })
  D.success(networkInterfacesTable)
}

/**
 * Generates the configuration object for making API requests to Azure
 * @param {string} url  The API endpoint to access
 * @returns {Object} The configuration object for the HTTP request
 */
function generateConfig(url) {
  return {
    url: "/subscriptions/" + subscriptionId + url,
    protocol: "https",
    headers: {
      "Authorization": "Bearer " + accessToken,
    },
    rejectUnauthorized: false,
    jar: true
  }
}

/**
 * Retrieves network interfaces from the Azure cloud service
 * @returns {Promise} A promise that resolves with the list of network interfaces
 */
function retrieveNetworkInterfaces() {
  const d = D.q.defer()
  const config = generateConfig("/providers/Microsoft.Network/networkInterfaces?api-version=2023-02-01")
  azureCloudManagementService.http.get(config, processNetworkInterfacesResponse(d))
  return d.promise
}

/**
 * Retrieves performance metrics for the specified network interfaces
 * @param {Array} networkInterfaces  The list of network interfaces to get metrics for
 * @returns {Promise} A promise that resolves with a list of performance metrics
 */
function retrieveNIPerformanceMetrics(networkInterfaces) {
  const promises = networkInterfaces.map(function (networkInterface) {
    const d = D.q.defer()
    const config = generateConfig('/resourceGroups/' + networkInterface.resourceGroupName + '/providers/Microsoft.Network/networkInterfaces/' + networkInterface.name + '/providers/microsoft.insights/metrics?api-version=2023-10-01&metricnames=' + performanceMetrics.join(',') + '&timespan=PT1M')
    azureCloudManagementService.http.get(config, processNIPerformanceMetricsResponse(d))
    return d.promise
  })
  return D.q.all(promises)
}

/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
  login()
    .then(retrieveNetworkInterfaces)
    .then(function(networkInterfaces) {
      return retrieveNIPerformanceMetrics(networkInterfaces)
        .then(function() {
          D.success()
        })
    })
    
    .catch(function (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get Azure Network Interfaces
 * @documentation This procedure is used to extract Azure network interfaces and their performance metrics
 */
function get_status() {
  login()
    .then(retrieveNetworkInterfaces)
    .then(function(networkInterfaces) {
      return retrieveNIPerformanceMetrics(networkInterfaces)
        .then(function(metricsList) {
          return insertRecord(networkInterfaces, metricsList)
        })
    })
    .catch(function (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}
