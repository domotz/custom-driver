/**
 * Domotz Custom Driver
 * Name: Azure Storage Accounts
 * Description: This script retrieves information about Azure storage accounts and their associated performance metrics
 *
 * Communication protocol is HTTPS
 *
 * Creates Custom Driver table with the following columns:
 * 			- Resource Group
 * 			- Location
 * 			- Provisioning State
 * 			- Creation Time
 * 			- Primary Location
 * 			- Status of Primary
 * 			- SKU Name
 * 			- SKU Tier
 * 			- Kind
 * 
 * The following performance metrics are retrieved dynamically:
 *      - Availability (%)
 *      - Egress (GB)
 *      - Ingress (GB)
 *      - Success E2E Latency (ms)
 *      - Success Server Latency (ms)
 *      - Transactions
 *      - Used Capacity (GB)
 * 
 * Additional metrics can be added or removed from the metricList array
 * 
 **/

// Parameters for Azure authentication

const tenantId = D.getParameter('tenantId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')
const subscriptionId = D.getParameter('subscriptionId')

// List of resource groups to filter
const resourceGroups = D.getParameter('resourceGroups')

// Create external devices for Azure login and management services
const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com')
const azureCloudManagementService = D.createExternalDevice('management.azure.com')

// Variable to store access token for Azure API calls
let accessToken

// Define metrics to retrieve from Azure storage accounts
// All metric List can be monitored ['Availability:Percent','Egress:Bytes','Ingress:Bytes','SuccessE2ELatency:MilliSeconds','SuccessServerLatency:MilliSeconds','Transactions:Count','UsedCapacity:Bytes']
const metricList = [
	'Availability:%',
	'Egress:Bytes',
	'Ingress:Bytes',
	'SuccessE2ELatency:ms',
	'SuccessServerLatency:ms',
	'Transactions',
	'UsedCapacity:Bytes'
]

/**
 * Parses a metric string and returns an object with label and unit
 * @param {string} metric The metric string in the format "label:unit"
 * @returns {Object} An object containing the label and unit of the metric
 */
function parseMetric(metric) {
	const parts = metric.split(":")
	return {
		label: parts[0],
		unit: parts[1] || ''
	}
}

/**
 * Creates a payload of parsed metrics
 * @returns {Array} An array of metric objects with label and unit
 */
function createMetricsPayload() {
	return metricList.map(parseMetric)
}

const storageAccountColumns = [
	{ label: 'Resource Group', valueType: D.valueType.STRING },
	{ label: 'Location', valueType: D.valueType.STRING },
	{ label: 'Provisioning State', valueType: D.valueType.STRING },
	{ label: 'Creation Time', valueType: D.valueType.DATETIME },
	{ label: 'Primary Location', valueType: D.valueType.STRING },
	{ label: 'Status of Primary', valueType: D.valueType.STRING },
	{ label: 'SKU Name', valueType: D.valueType.STRING },
	{ label: 'SKU Tier', valueType: D.valueType.STRING },
	{ label: 'Kind', valueType: D.valueType.STRING }
]

// Create metric columns, replacing 'Bytes' with 'GB' where necessary
const metricColumns = metricList.map(function(metric) {
	const metricInfo = parseMetric(metric)
	if (metricInfo.unit === 'Bytes') {
		metricInfo.unit = 'GB'
	}
	return metricInfo
})

// Combine storage account columns and metric columns into a single array
const allColumns = storageAccountColumns.concat(metricColumns)

// Create the storage account table with all defined columns
const storageAccountTables = D.createTable('Storage Accounts', allColumns)

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
      console.error('Access token not found in response body')
      D.failure(D.errorType.AUTHENTICATION_ERROR)
    }
  }
}

/**
 * Filters the network interfaces based on the provided VM names and resource groups
 * @param {Array} storageAccounts The list of network interfaces to filter
 * @returns {Array} The filtered list of network interfaces
 */
function filterStorageAccountsByRG(storageAccounts) {
  return storageAccounts.filter(function(storageAccount) {
    const resourceGroupName = storageAccount.resourceGroupName
    return  (resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') || resourceGroups.some(function(resourceGroup) { return resourceGroup.toLowerCase() === resourceGroupName.toLowerCase()})
	})
}

/**
 * Processes the response containing storage accounts, filtering and resolving the data.
 * @param {Object} d The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processStorageAccountsResponse(d) {
  return function process(error, response, body) {
    checkHTTPError(error, response)
    const bodyAsJSON = JSON.parse(body)
    if (Array.isArray(bodyAsJSON.value) && bodyAsJSON.value.length > 0) {
      const storageAccounts = bodyAsJSON.value.map(extracStorageAccountsInfo)
      const filteredAccounts = filterStorageAccountsByRG(storageAccounts)
      d.resolve(filteredAccounts)
    } else {
      console.error('No storage accounts found')
      D.failure(D.errorType.GENERIC_ERROR)
    }
  }
}

/**
 * Processes the performance metrics response for storage accounts
 * @param {Object} d The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processStorageAccountsMetricsResponse(d) {
  return function process(error, response, body) {
    checkHTTPError(error, response);
    const bodyAsJSON = JSON.parse(body)
    if (Array.isArray(bodyAsJSON.value) && bodyAsJSON.value.length > 0) {
      const metricsData = extractMetricsInfo(bodyAsJSON)
      d.resolve(metricsData)
    } else {
      console.error('No performance metrics found for the storage account')
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
    url: '/' + tenantId + '/oauth2/token', 
    protocol: 'https', 
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    }, 
    form: {
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      resource: 'https://management.azure.com\/'
    }, 
    rejectUnauthorized: false, 
    jar: true
  }
  azureCloudLoginService.http.post(config, processLoginResponse(d))
  return d.promise
}

/**
 * Extracts information from a storage account object
 * @param {Object} storageAccounts The storage account object
 * @returns {Object} An object containing relevant storage account information
 */
function extracStorageAccountsInfo(storageAccounts) {
  let resourceGroupName = 'N/A'
  if (storageAccounts.id) {
    const matches = storageAccounts.id.match(/resourceGroups\/([^/]+)/)
    resourceGroupName = matches ? matches[1] : 'N/A'
  } else {
    resourceGroupName = 'N/A'
  }
  const properties = storageAccounts.properties || {}
  const sku = storageAccounts.sku || {}
  return {
		name: storageAccounts.name || 'N/A', 
    resourceGroupName, 
		location: storageAccounts.location || 'N/A',
		provisioningState: properties.provisioningState || 'N/A',
		creationTime: properties.creationTime || 'N/A',
		primaryLocation: properties.primaryLocation || 'N/A',
		statusOfPrimary: properties.statusOfPrimary || 'N/A',
		skuName: sku.name || 'N/A',
		skuTier: sku.tier || 'N/A',
		kind: storageAccounts.kind || 'N/A'
  }
}

/**
 * Extracts performance metrics information from the metrics response
 * @param {Object} metricsResponse The response object containing metrics data
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
			const nonTimestampValue = Object.keys(latestValue).find(function(key) { return key !== 'timeStamp' })
      metricsInfo[metricName] = nonTimestampValue ? latestValue[nonTimestampValue] : 'N/A'
    } else {
      metricsInfo[metricName] = 'N/A'
    }
  })
  return metricsInfo
}

/**
 * Function to convert date to UTC format
 * @param {string} dateToConvert The date string to be converted
 * @returns {string} The date string in UTC format
 */
function convertToUTC(dateToConvert) {
	var date = new Date(dateToConvert)
	var month = (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1)
	var day = (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate()
	var year = date.getUTCFullYear()
	var hours = (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours()
	var minutes = (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes()
	var seconds = (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds()
	return month + "/" + day + "/" + year + " " + hours + ":" + minutes + ":" + seconds + " UTC"
}

/**
 * Converts bytes to gigabytes
 * @param {number} bytes The number of bytes to convert
 * @returns {number} The value in gigabytes or 'N/A'
 */
function convertToGB(bytes) {
	return bytes !== 'N/A' ? (bytes / 1e9).toFixed(2) : bytes
} 

/**
 * Inserts records into the storage accounts table with associated metrics
 * @param {Array} storageAccounts The list of storage accounts to insert
 * @param {Array} metricsList The list of performance metrics corresponding to the storage accounts
 */
function insertRecord(storageAccounts, metricsList) {
	storageAccounts.forEach(function(account, index) {
		const metricsData = metricsList[index] || {}
		const rowData = [
			account.resourceGroupName,
			account.location,
			account.provisioningState,
			convertToUTC(account.creationTime),
			account.primaryLocation,
			account.statusOfPrimary,
			account.skuName,
			account.skuTier,
			account.kind
		]
		metricList.forEach(function(metric) {
			const metricName = metric.split(":")[0]
			let metricValue = metricsData[metricName] || 'N/A'
			if (metric.split(":")[1] === 'Bytes') {
				metricValue = convertToGB(metricValue)
			}
			if (typeof metricValue === 'number') {
				metricValue = (metricValue === 0 || Number.isInteger(metricValue)) ? metricValue : metricValue.toFixed(2)
			}
			rowData.push(metricValue)
		})
		storageAccountTables.insertRecord(account.name, rowData)
	})
	D.success(storageAccountTables)
}

/**
 * Generates the configuration object for making API requests to Azure
 * @param {string} url  The API endpoint to access
 * @returns {Object} The configuration object for the HTTP request
 */
function generateConfig(url) {
  return {
    url: '/subscriptions/' + subscriptionId + url,
    protocol: 'https',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
    },
    rejectUnauthorized: false,
    jar: true
  }
}

/**
 * Retrieves storage accounts from the Azure cloud service
 * @returns {Promise} A promise that resolves with the list of storage accounts
 */
function retrieveStorageAccounts() {
  const d = D.q.defer()
  const config = generateConfig('/providers/Microsoft.Storage/storageAccounts?api-version=2024-01-01')
  azureCloudManagementService.http.get(config, processStorageAccountsResponse(d))
  return d.promise
}

/**
 * Retrieves performance metrics for the specified storage accounts
 * @param {Array} storageAccounts The list of storage accounts to get metrics for
 * @returns {Promise} A promise that resolves with a list of performance metrics
 */
function retrieveStorageAccountsMetrics(storageAccounts) {
  const promises = storageAccounts.map(function (storageAccount) {
    const d = D.q.defer()
		const metrics = createMetricsPayload()
		const metricNames = metrics.map(function(metric){return metric.label}).join(',')
    const config = generateConfig('/resourceGroups/' + storageAccount.resourceGroupName + '/providers/Microsoft.Storage/storageAccounts/' + storageAccount.name + '/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=' + metricNames + '&timespan=PT1H')
    azureCloudManagementService.http.get(config, processStorageAccountsMetricsResponse(d))
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
    .then(retrieveStorageAccounts)
    .then(function(storageAccounts) {
			return retrieveStorageAccountsMetrics(storageAccounts)
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
 * @label Get Azure Storage Accounts
 * @documentation This procedure is used to extract Azure storage accounts and their performance metrics
 */
function get_status() {
  login()
    .then(retrieveStorageAccounts)
		.then(function(storageAccounts) {
			return retrieveStorageAccountsMetrics(storageAccounts)
			.then(function(metricsList) {
				return insertRecord(storageAccounts, metricsList)
			})
	  })
    .catch(function (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}