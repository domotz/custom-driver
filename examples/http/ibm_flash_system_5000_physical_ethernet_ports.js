/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 Physical Ethernet Ports
 * Description: Monitors the Physical Ethernet Ports of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Node Name: The name of the node where the port is located
 *      - MAC Address: The Media Access Control address, a unique identifier for the network interface
 *      - Duplex: Indicates the mode of communication (e.g., full or half duplex) for data transmission
 *      - Speed: The data transfer rate of the port
 *      - Link State: The operational status of the port
 *      - DCBX State: The status of the Data Center Bridging Exchange protocol
 *      - Adapter Location: The physical location of the adapter within the system
 *      - Adapter Port ID: The identifier for the specific adapter port
 *      - Host: Indicates whether the port is connected to a host
 *      - Storage: Indicates whether the port is connected to storage
 *      - Replication: Indicates whether the port supports replication features
 *      - Ethernet Clustering: Indicates if the port is part of an Ethernet clustering configuration
 *      - Management: Indicates whether the port is used for management purposes
 *
 **/

const endpointDetails = {
    "endpoint": "lsportethernet"
}

var ethernetPortsTable = D.createTable(
    'Physical Ethernet Ports Details',
    [
        {label: "Node Name", valueType: D.valueType.STRING},
        {label: "MAC Address", valueType: D.valueType.STRING},
        {label: "Duplex", valueType: D.valueType.STRING},
        {label: "Speed", valueType: D.valueType.NUMBER, unit:"Gb/s"},
        {label: "Link State", valueType: D.valueType.STRING},
        {label: "DCBX State", valueType: D.valueType.STRING},
        {label: "Adapter Location", valueType: D.valueType.NUMBER},
        {label: "Adapter Port ID", valueType: D.valueType.NUMBER},
        {label: "Host", valueType: D.valueType.STRING},
        {label: "Storage", valueType: D.valueType.STRING},
        {label: "Replication", valueType: D.valueType.STRING},
        {label: "Ethernet Clustering", valueType: D.valueType.STRING},
        {label: "Management", valueType: D.valueType.STRING}
    ]
);


/**
 * Sends an HTTPS POST request and returns the parsed JSON response.
 * @param {string} endpoint - The API endpoint.
 * @param {Object} headers - The request headers.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttps(endpoint, headers) {
    const d = D.q.defer();
    const config = {
        url: endpoint,
        protocol: "https",
        port: 7443,
        rejectUnauthorized: false,
        headers: headers
    };
    D.device.http.post(config, function (error, response, body) {
        if (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (!response || response.statusCode === 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
        else if (response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            d.resolve(JSON.parse(body));
        }
    })
    return d.promise
}

/**
 * Calls an HTTPS endpoint with an authentication token.
 * @param {string} token - Auth token for the request.
 * @param {string} endpoint - The API endpoint.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttpsEndpoint(token, endpoint) {
    const headers = {"X-Auth-Token": token}
    return callHttps(endpoint, headers)
}

/**
 * Logs in using the device's credentials.
 * @returns {Promise<Object>} Parsed JSON login response.
 */
function login() {
    const endpoint = "/rest/auth"
    const headers = {
        "Content-Type": "application/json",
        'X-Auth-Username': D.device.username(),
        'X-Auth-Password': D.device.password()
    }
    return callHttps(endpoint, headers)
}

/**
 * Populates the Physical Ethernet Ports table with details from a list.
 * @param {Array<Object>} ethernetPortsList - List of managed disk details.
 */
function populateTable(ethernetPortsList) {
    for (let i = 0; i < ethernetPortsList.length; i++) {
        const portDetails = ethernetPortsList[i];
        ethernetPortsTable.insertRecord(portDetails['port_id'] + " - " + portDetails['node_id'], [
            portDetails['node_name'] || "N/A",
            portDetails['MAC'] || "N/A",
            portDetails['duplex'] || "N/A",
            portDetails['speed'] ? convertToGbps(portDetails['speed']) : 0,
            portDetails['link_state'] || "N/A",
            portDetails['dcbx_state'] || "N/A",
            portDetails['adapter_location'] || "N/A",
            portDetails['adapter_port_id'] || "N/A",
            portDetails['host'] || "N/A",
            portDetails['storage'] || "N/A",
            portDetails['replication'] || "N/A",
            portDetails['eth_clustering'] || "N/A",
            portDetails['management'] || "N/A"
        ]);
    }
}

/**
 * Converts input with units (Mb/s, Gb/s, Tb/s) to Gigabits per second (Gb/s).
 * @param {string} inputValue - The value with unit (Mb/s, Gb/s, Tb/s).
 * @returns {string} Converted value in Gbps.
 */
function convertToGbps(inputValue) {
    const valueUnitRegex = /^(\d+\.?\d*)\s*(\D+)$/;  // Regex to match value and unit
    const matchedResult = inputValue.match(valueUnitRegex);
    if (matchedResult) {
        return formatValueToGbps(parseFloat(matchedResult[1]), matchedResult[2].trim());
    } else {
        throw new Error('Invalid input format');
    }
}

/**
 * Converts a value from Mb/s, Gb/s, or Tb/s to Gb/s.
 * @param {number} value - The numeric value.
 * @param {string} unit - The unit of the value (Mb/s, Gb/s, Tb/s).
 * @returns {string} Value converted to Gbps.
 */
function formatValueToGbps(value, unit) {
    switch (unit.toLowerCase()) {
        case 'mb/s':
            return (value / 1024).toFixed(4);
        case 'gb/s':
            return value.toFixed(2);
        case 'tb/s':
            return (value  * 1024).toFixed(2);
        default:
            throw new Error('Unknown unit: ' + unit);
    }
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                .then(function () {
                    D.success()
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get IBM FlashSystem5000 Physical Ethernet Ports
 * @documentation This procedure retrieves the Physical Ethernet Ports of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                .then(function (response) {
                    populateTable(response)
                    D.success(ethernetPortsTable)
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
