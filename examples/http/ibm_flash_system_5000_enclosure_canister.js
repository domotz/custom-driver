/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Enclosure Canister
 * Description: This script retrieves the status for each canister in an enclosure of the IBM FlashSystem5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns: 
 * 		- Enclosure ID: The enclosure id that contains the canister
 * 		- Canister ID: Indicates which of the canisters in the enclosure it is
 * 		- Status: The status of the canister
 *    - Type: The type of canister
 *    - Node ID: The node id that corresponds to this canister
 *    - Node Name: The node anme that corresponds to this canister
 * 
 **/

var canisterTable = D.createTable(
	'Canisters',
	[
		{label: "Enclosure ID", valueType: D.valueType.NUMBER},
		{label: "Canister ID", valueType: D.valueType.NUMBER},
		{label: "Status", valueType: D.valueType.STRING},
		{label: "Type", valueType: D.valueType.STRING},
		{label: "Node ID", valueType: D.valueType.NUMBER},
		{label: "Node Name", valueType: D.valueType.STRING}
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
 * Retrieves information about canisters from the IBM FlashSystem5000 using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing canister information
 */
function getCanisters(token) {
	const endpoint = '/rest/lsenclosurecanister'
	const headers = {
		'Content-Type': 'application/json',
		'X-Auth-Token': token.token,
	}
	return callHttps(endpoint, headers)
}

/**
 * Populates the Canisters table with the retrieved data from the API
 * @param {Array} data An array of canister information objects returned from the API
 */
function populateTable(data) {
	for (let i = 0; i < data.length; i++) {
		const canisterInfo = data[i]
		canisterTable.insertRecord((i+1).toString(), [
			canisterInfo.enclosure_id || 'N/A',
			canisterInfo.canister_id || 'N/A',
			canisterInfo.status || 'N/A',
			canisterInfo.type || 'N/A',
			canisterInfo.node_id || 'N/A',
			canisterInfo.node_name || 'N/A'
		])
	}
	D.success(canisterTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
	login()
		.then(getCanisters)
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
 * @label Get IBM FlashSystem5000 Canister Information
 * @documentation This procedure retrieves information about each canister in the IBM FlashSystem5000 enclosure
 */
function get_status() {
	login()
		.then(getCanisters)
		.then(populateTable)
		.catch(function (error) {
			console.error('Validation failed: ', error)
			D.failure(D.errorType.GENERIC_ERROR)
		})
}