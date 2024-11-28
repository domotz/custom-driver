/**
 * Domotz Custom Driver
 * Name: Azure - Daily Billing Costs Summary
 * Description: This script retrieves Azure usage data for the previous day and provides a summary of the total cost for each Service Name.

 * Communication protocol is HTTPS
 * 
 * Create a custom driver table with a column for Pre-Tax Cost, representing the cost before tax for the specified usage
 * 
 * create Custom Driver Variable to monitor and display the Total Cost
 * 
 **/

// Parameters for Azure authentication
const tenantId = D.getParameter('tenantId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')
const subscriptionId = D.getParameter('subscriptionId')

// Create external devices for Azure login and management services
const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com')
const azureCloudManagementService = D.createExternalDevice('management.azure.com')

// Variable to store access token for Azure API calls
let accessToken

const table =  D.createTable('Azure Cost Metrics', [
  { label: 'Pre Tax Cost', unit: 'EUR', valueType: D.valueType.NUMBER }
])

const today = new Date()
const startDate = new Date(today)
startDate.setDate(today.getDate() - 1) 

// Define the request body for querying usage and cost data for the previous day
const DailyRequestBody = {
	type: "Usage",
	timeframe: "Custom",
	timePeriod: {
		from: startDate,
		to: startDate
	},
	dataset: {
		granularity: "Daily",
		aggregation: {
			totalCost: {
				name: "PreTaxCost",
				function: "Sum"
			}
		},
		grouping: [
			{ type: "Dimension", name: "ServiceName" },
		]
	}
}

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
		console.log(response.body)
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
 * Processes the cost data response and extracts relevant metrics information.
 * @param {Object} d The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processCostResponse(d) {
	return function process(error, response, body) {
    checkHTTPError(error, response)
    const bodyAsJSON = JSON.parse(body)
    if (bodyAsJSON && bodyAsJSON.properties && bodyAsJSON.properties.rows && bodyAsJSON.properties.rows.length > 0) {
			const metricsData = extractMetricsInfo(bodyAsJSON)
      d.resolve(metricsData)
    } else {
			console.error('Data not found in response body')
      D.failure(D.errorType.AUTHENTICATION_ERROR)
    }
  }
}

/**
 * Logs in to Azure cloud service and retrieves an access token
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
 * Queries the Azure Cost Management API for cost data
 * @returns {Promise} A promise that resolves with the cost data
 */
function queryCostData() {
  const d = D.q.defer()
  const config = {
    url: '/subscriptions/' + subscriptionId + '/providers/Microsoft.CostManagement/query?api-version=2023-11-01',
    protocol: 'https', 
    headers: {
      'Authorization': 'Bearer ' + accessToken,
			'Content-Type': 'application/json'
    },
		body: JSON.stringify(DailyRequestBody),
    rejectUnauthorized: false, 
    jar: true
  }
	azureCloudManagementService.http.post(config, processCostResponse(d))
  return d.promise
}

/**
 * Extracts metrics information from the response
 * @param {Object} metricsResponse The response object from the cost data query
 * @returns {Object} An object containing the metrics and total cost
 */
function extractMetricsInfo(metricsResponse) {
  const columns = metricsResponse.properties.columns
  let totalCost = 0
  let data = metricsResponse.properties.rows.map(function(row) {
    const rowData = {}
    columns.forEach(function(column, i) {
      const value = column.type === "Number" ? row[i].toString() : row[i]
      rowData[column.name] = value
      if (column.name === "PreTaxCost") {
        let roundedPreTaxCost = parseFloat(value).toFixed(2)
        roundedPreTaxCost = parseFloat(roundedPreTaxCost)
        totalCost += roundedPreTaxCost
        rowData[column.name] = roundedPreTaxCost
      }
    })
    delete rowData.UsageDate
    delete rowData.Currency
    return rowData
  })
  return {
    metrics: data,
    totalCost: totalCost 
  }
}

/**
 * Sanitizes the output by removing reserved words and formatting it
 * @param {string} output The string to be sanitized
 * @returns {string} The sanitized string
 */
function sanitize(output) {
  const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Inserts records into the metrics table and creates a variable for total cost
 * @param {Object} data The data object containing metrics and total cost
 */
function insertRecords(data) {
  if (!data || !data.metrics || data.metrics.length === 0) {
    console.error("No metrics data provided")
    return
  }
  data.metrics.forEach(function(row) {
    var recordId = sanitize(row.ServiceName)
    table.insertRecord(recordId, [
      row.PreTaxCost
    ])
  })
  D.success([D.createVariable("total-cost", "Total Cost", (data.totalCost).toFixed(2), data.metrics[0].Currency, D.valueType.NUMBER)], table)
}

/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
  login()
    .then(queryCostData)
    .then(function(){
      D.success()
    })
    .catch(function (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get Azure Billing Daily Costs Summary
 * @documentation This procedure retrieves Azure usage and cost data for the previous day and summarizes the key metrics, including the Service Name
 */
function get_status() {
  login()
    .then(queryCostData)
		.then(insertRecords)
    .catch(function (error) {
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}