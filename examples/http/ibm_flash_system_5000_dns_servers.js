/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 DNS Servers
 * Description: This script retrieves DNS server information from the IBM FlashSystem5000
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on FlashSystem5000 version: 8.5.0.6
 * 
 * Creates a Custom Driver table with the following columns: 
 *     - Name: The DNS server name
 *     - Type: The DNS server Internet Protocol (IP) address type
 *     - IP Address: The IP address of the DNS server
 *     - Status: Current status of the DNS server
 * 
 **/

var dnsServersTable = D.createTable(
	'DNS Servers',
	[
		{label: "Name", valueType: D.valueType.STRING},
		{label: "Type", valueType: D.valueType.STRING},
		{label: "IP Address", valueType: D.valueType.STRING},
		{label: "Status", valueType: D.valueType.STRING}
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
 * Retrieves information about DNS servers from the IBM FlashSystem5000 using the provided authentication token
 * @param {Object} token The authentication token obtained from the login function
 * @returns {Promise} A promise that resolves to the parsed JSON response containing DNS server information
 */
function getDNSServers(token) {
	const endpoint = '/rest/lsdnsserver'
	const headers = {
		'Content-Type': 'application/json',
		'X-Auth-Token': token.token,
	}
	return callHttps(endpoint, headers)
}

/**
 * Populates the DNS servers table with the retrieved data from the API
 * @param {Array} data An array of DNS server information objects returned from the API
 */
function populateTable(data) {
	for (let i = 0; i < data.length; i++) {
		const dnsServerInfo = data[i]
		dnsServersTable.insertRecord(dnsServerInfo.id, [
			dnsServerInfo.name || 'N/A',
			dnsServerInfo.type || 'N/A',
			dnsServerInfo.IP_address || 'N/A',
			dnsServerInfo.status || 'N/A',
		])
	}
	D.success(dnsServersTable)
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
	login()
		.then(getDNSServers)
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
 * @label Get IBM FlashSystem5000 DNS Servers Information
 * @documentation This procedure retrieves DNS server information for the IBM FlashSystem5000
 */
function get_status() {
	login()
		.then(getDNSServers)
		.then(populateTable)
		.catch(function (error) {
			console.error('Validation failed: ', error)
			D.failure(D.errorType.GENERIC_ERROR)
		})
}