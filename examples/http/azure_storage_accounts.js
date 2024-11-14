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
 *      - Availability 
 *      - Egress
 *      - Ingress
 *      - Success E2E Latency
 *      - Success Server Latency 
 *      - Transactions
 *      - Used Capacity 
 * 
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
let storageAccountTable

// Columns for the storage account table
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

// Define metrics to retrieve from Azure storage accounts
const metricList = [
  { label: 'Availability', valueType: D.valueType.NUMBER, unit: '%', key: 'Availability' },
  { label: 'Egress', valueType: D.valueType.NUMBER, unit: 'MB', key: 'Egress', callback: convertToMB },
  { label: 'Ingress', valueType: D.valueType.NUMBER, unit: 'MB', key: 'Ingress', callback: convertToMB },
  { label: 'Success E2E Latency', valueType: D.valueType.NUMBER, key: 'SuccessE2ELatency' },
  { label: 'Success Server Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'SuccessServerLatency' },
  { label: 'Transactions', valueType: D.valueType.NUMBER, key: 'Transactions' },
  { label: 'Used Capacity', valueType: D.valueType.NUMBER, unit: 'MB', key: 'UsedCapacity', callback: convertToMB }
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
 * Retrieves performance metrics for the given storage accounts
 * @param {Array} storageAccounts The list of storage accounts to retrieve metrics for
 * @returns {Promise} A promise that resolves when metrics have been retrieved for all storage accounts
 */
function retrieveStorageAccountsMetrics(storageAccounts) {
  const performanceKeyGroups = []
  const maxGroupSize = 20
  for (let i = 0; i < metricList.length; i += maxGroupSize) {
    performanceKeyGroups.push(metricList.slice(i, i + maxGroupSize).map(function (metric) {
      return metric.key
    }).join(','))
  }
  const promises = storageAccounts.map(function (storageAccount) {
    const d = D.q.defer()
    const groupPromises = performanceKeyGroups.map(function (group) {
      return new Promise(function () {
        const config = generateConfig("/resourceGroups/" + storageAccount.resourceGroupName + '/providers/Microsoft.Storage/storageAccounts/' + storageAccount.name + '/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=' + group + "&timespan=PT1H")
        azureCloudManagementService.http.get(config, processStorageAccountsMetricsResponse(d, storageAccount))
      })
    })
    D.q.all(groupPromises).then(function () {
      d.resolve(storageAccount)
    }).catch(d.reject)
    return d.promise
  })
  return D.q.all(promises)
}

/**
 * Creates a table to display Azure storage accounts and their associated metrics
 */
function createStorageAccountTable() {
  const metricColumns = metricList.map(function (metric) {
    return {
      label: metric.label,
      valueType: metric.valueType,
      unit: metric.unit || null
    }
  })
  const allColumns = storageAccountColumns.concat(metricColumns)
  storageAccountTable = D.createTable('Azure Storage Accounts', allColumns.map(function (item) {
    const tableDef = { label: item.label, valueType: item.valueType }
    if (item.unit) {
      tableDef.unit = item.unit
    }
    return tableDef
  }))
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
 * Formats the value to 2 decimal places, unless it's an integer
 * If the value is not a valid number or is 'N/A', returns 'N/A'
 * @param {number|string} value The value to format (can be a string or number)
 * @returns {string} The formatted value, or 'N/A' if the value is invalid
 */
function formatToTwoDecimals(value) {
  if (isNaN(value) || value === 'N/A') {
    return 'N/A'
  }
  const numValue = parseFloat(value)
  if (Number.isInteger(numValue)) {
    return numValue.toString()
  }
  return numValue.toFixed(2)
}

/**
 * Converts bytes to megabytes (MB)
 * @param {number} bytes The number of bytes to convert
 * @returns {number} The value in megabytes or 'N/A'
 */
function convertToMB(bytes) {
  return formatToTwoDecimals(bytes !== 'N/A' ? bytes / 1e6 : bytes)
} 

/**
 * Sanitizes the output by removing reserved words and formatting it.
 * @param {string} output - The string to be sanitized.
 * @returns {string} The sanitized string.
 */
function sanitize(output) {
  const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Inserts a record of a storage account and its metrics into the table
 * @param {Object} storageAccount The storage account object
 * @param {Object} metrics The metrics data for the storage account
 */
function insertRecord(storageAccount, metrics) {
  const recordValues = [
    storageAccount.resourceGroupName,
    storageAccount.location,
    storageAccount.provisioningState,
    convertToUTC(storageAccount.creationTime),
    storageAccount.primaryLocation,
    storageAccount.statusOfPrimary,
    storageAccount.skuName,
    storageAccount.skuTier,
    storageAccount.kind
  ]
  metricList.forEach(function (metric) {
    const metricValue = metrics[metric.key] || 'N/A'
    recordValues.push(metric.callback ? formatToTwoDecimals(metric.callback(metricValue)) : formatToTwoDecimals(metricValue));
  })
  storageAccountTable.insertRecord(sanitize(storageAccount.name), recordValues)
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
        .then(function(metricsData) {
          createStorageAccountTable()
          storageAccounts.forEach(function(storageAccount, index) {
            const metrics = metricsData[index]
            insertRecord(storageAccount, metrics)
          })
          D.success(storageAccountTable)
        })
    })
    .catch(function (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}