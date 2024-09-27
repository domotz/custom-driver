/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Enclosure Power Supply Unit
 * Description: This script retrieves information about each power-supply unit (PSU) within the enclosure of the IBM FlashSystem5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns: 
 * 		- Enclosure ID: The ID of the enclosure that contains the PSU
 * 		- PSU ID: The ID of the PSU in the enclosure
 * 		- Status: The status of the power and cooling unit in the enclosure
 * 		- Input Power: The amount of electrical power being supplied to the PSU
 * 
 **/

var psuTable = D.createTable(
	'Power Supply Units',
	[
		{label: "Enclosure ID", valueType: D.valueType.NUMBER},
		{label: "PSU ID", valueType: D.valueType.NUMBER},
		{label: "Status", valueType: D.valueType.STRING},
		{label: "Input Power", valueType: D.valueType.STRING}
	]
)
  
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
 * Retrieves information about power supply units from the IBM FlashSystem5000 using the provided authentication token.
 * @param {Object} token The authentication token obtained from the login function.
 * @returns {Promise} A promise that resolves to the parsed JSON response containing PSU information.
 */
function getPowerSupplyUnits(token) {
	const endpoint = '/rest/lsenclosurepsu'
	const headers = {
		'Content-Type': 'application/json',
		'X-Auth-Token': token.token,
	}
	return callHttps(endpoint, headers)
}

/**
 * Populates the Power Supply Units table with the retrieved data from the API
 * @param {Array} data An array of PSU information objects returned from the API
 */
function populateTable(data) {
	for (let i = 0; i < data.length; i++) {
		const psuInfo = data[i]
		psuTable.insertRecord((i+1).toString(), [
			psuInfo.enclosure_id || 'N/A',
			psuInfo.PSU_id || 'N/A',
			psuInfo.status || 'N/A',
			psuInfo.input_power || 'N/A',
		])
	}
	D.success(psuTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
	login()
		.then(getPowerSupplyUnits)
		.then(function(response) {
			if (!response || !Array.isArray(response) || response.length === 0) {
				console.error('Validation failed: No data found')
				D.failure(D.errorType.PARSING_ERROR)
			}
			console.log('Validation successful')
			D.success()
		})
		.catch(function (error) {
			console.error('Validation failed: ', error)
			D.failure(D.errorType.GENERIC_ERROR)
		})
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 Power Supply Units Information
 * @documentation This procedure retrieves power supply unit information for the IBM FlashSystem5000
 */
function get_status() {
	login()
		.then(getPowerSupplyUnits)
		.then(populateTable)
		.catch(function (error) {
			console.error('Validation failed: ', error)
			D.failure(D.errorType.GENERIC_ERROR)
		})
}