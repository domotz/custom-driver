/**
 * Domotz Custom Driver
 * Name: Azure Billing Cost
 * Description: This script retrieves Azure billing metrics to monitor costs and usage, categorized by several key dimensions
 *
 * Communication protocol is HTTPS
 * 
 * Create a custom driver table with the following columns:
 *    - PreTaxCost: The cost before tax for the specified usage
 *    - UsageDate: The date for which the usage data is reported
 *    - Meter: The meter associated with the usage
 *    - MeterSubcategory: The subcategory of the meter
 *    - ResourceGroup: The Azure resource group to which the resources belong
 *    - ServiceName: The name of the Azure service used
 *    - ResourceLocation: The location of the Azure resources
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
			{ type: "Dimension", name: "Meter" },
			{ type: "Dimension", name: "MeterSubcategory" },
			{ type: "Dimension", name: "ResourceGroup" },
			{ type: "Dimension", name: "ServiceName" },
			{ type: "Dimension", name: "ResourceLocation" }
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
  const data = metricsResponse.properties.rows.map(function(row) {
    const rowData = {}
    columns.forEach(function(column, i) {
      const value = column.type === "Number" ? row[i].toString() : row[i]
      rowData[column.name] = value;
      if (column.name === "PreTaxCost") {
        totalCost += parseFloat(value)
      }
    })
    if (rowData.UsageDate) {
      rowData.UsageDate = rowData.UsageDate.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
    }
    return rowData
  })
  return {
    metrics: data,
    totalCost: totalCost 
  }
}

/**
 * Creates dynamic columns for the metrics table based on the retrieved data
 * @param {Array} metrics The metrics data
 * @returns {Object} The created table or null if no metrics are provided
 */
function createDynamicColumns(metrics) {
	if (!metrics || metrics.length === 0) return null
	const firstRow = metrics[0]
	const tableColumns = Object.keys(firstRow)
	.filter(function (key) { return key !== 'Currency' })
	.map(function(key) {
		return {
			label: key,
			unit: key === 'PreTaxCost' ? firstRow.Currency : '',
			valueType: typeof firstRow[key] === 'string' ? D.valueType.STRING : D.valueType.NUMBER
		}
	})
	return D.createTable('Azure Cost Metrics', tableColumns)
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
	const table = createDynamicColumns(data.metrics)
	data.metrics.forEach(function(row, index) {
    var recordId = index.toString()
    var values = Object.keys(row)
      .filter(function(key) { return key !== 'Currency' })
      .map(function(key) { return row[key] })
    table.insertRecord(recordId, values)
  })
	D.success([D.createVariable("total-cost", "Total Cost", data.totalCost, data.metrics[0].Currency, D.valueType.NUMBER)], table)
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
 * @label Get Azure Billing Costs Data
 * @documentation This procedure retrieves Azure cost data and associated performance metrics
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