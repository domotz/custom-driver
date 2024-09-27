/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 iSCSI Ports Information
 * Description: Monitors the iSCSI Ports Information of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Node ID: Identifier for the node in the storage system
 *      - Node Name: Name of the node in the storage system
 *      - IP Address: IPv4 address assigned to the port
 *      - Mask: Subnet mask for the IPv4 address
 *      - Gateway: Default gateway address for the port
 *      - IP Address 6: IPv6 address assigned to the port
 *      - Prefix 6: Prefix length for the IPv6 address
 *      - Gateway 6: Default gateway address for the IPv6 address
 *      - MAC Address: Media Access Control address for the network interface
 *      - Duplex: Indicates if the connection is full duplex or half duplex
 *      - State: Current state of the port
 *      - Speed: Speed of the connection
 *      - Failover: Indicates if failover is enabled or disabled
 *      - Link State: Current link state
 *      - Host: Hostname or identifier of the connected host
 *      - Remote Copy: Identifier for remote copy configuration
 *      - Host 6: Hostname or identifier of the connected host for IPv6
 *      - Remote Copy 6: Identifier for remote copy configuration for IPv6
 *      - Remote Copy Status: Current status of the remote copy configuration
 *      - Remote Copy Status 6: Current status of the remote copy configuration for IPv6
 *      - VLAN: Virtual Local Area Network identifier associated with the port
 *      - VLAN 6: VLAN identifier for IPv6
 *      - Adapter Location: Physical location of the adapter in the system
 *      - Adapter Port ID: Identifier for the specific adapter port
 *      - Storage: Storage configuration associated with the port
 *      - Storage 6: Storage configuration for IPv6
 *      - Host Port Group ID: Identifier for the host port group
 *      - RDMA Type
 *      - Is RDMA Clustering
 **/

const endpointDetails = {
    "endpoint": "lsportip"
}

const iSCSIPortsTable = D.createTable(
    'iSCSI Ports',
    [
        {label: "Node ID", valueType: D.valueType.NUMBER},
        {label: "Node Name", valueType: D.valueType.STRING},
        {label: "IP Address", valueType: D.valueType.STRING},
        {label: "Mask", valueType: D.valueType.STRING},
        {label: "Gateway", valueType: D.valueType.STRING},
        {label: "IP Address 6", valueType: D.valueType.STRING},
        {label: "Prefix 6", valueType: D.valueType.STRING},
        {label: "Gateway 6", valueType: D.valueType.STRING},
        {label: "MAC", valueType: D.valueType.STRING},
        {label: "Duplex", valueType: D.valueType.STRING},
        {label: "State", valueType: D.valueType.STRING},
        {label: "Speed", valueType: D.valueType.NUMBER, unit:"Gb/s"},
        {label: "Failover", valueType: D.valueType.STRING},
        {label: "Link State", valueType: D.valueType.STRING},
        {label: "Host", valueType: D.valueType.STRING},
        {label: "Remote Copy", valueType: D.valueType.NUMBER},
        {label: "Host 6", valueType: D.valueType.STRING},
        {label: "Remote Copy 6", valueType: D.valueType.NUMBER},
        {label: "Remote Copy Status", valueType: D.valueType.STRING},
        {label: "Remote Copy Status 6", valueType: D.valueType.STRING},
        {label: "VLAN", valueType: D.valueType.STRING},
        {label: "VLAN 6", valueType: D.valueType.STRING},
        {label: "Adapter Location", valueType: D.valueType.NUMBER},
        {label: "Adapter Port ID", valueType: D.valueType.NUMBER},
        {label: "Storage", valueType: D.valueType.STRING},
        {label: "Storage 6", valueType: D.valueType.STRING},
        {label: "Host Port Group ID", valueType: D.valueType.NUMBER},
        {label: "RDMA Type", valueType: D.valueType.STRING},
        {label: "Is RDMA Clustering", valueType: D.valueType.STRING}
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
 * Populates the iSCSI Ports table with details from a list.
 * @param {Array<Object>} iSCSIPortsDetailsList - List of managed disk details.
 */
function populateTable(iSCSIPortsDetailsList) {
    for (let i = 0; i < iSCSIPortsDetailsList.length; i++) {
        const iSCSIPortsDetails = iSCSIPortsDetailsList[i];
        iSCSIPortsTable.insertRecord(i+1 + "", [
            iSCSIPortsDetails['node_id'] || "N/A",
            iSCSIPortsDetails['node_name'] || "N/A",
            iSCSIPortsDetails['IP_address'] || "N/A",
            iSCSIPortsDetails['mask'] || "N/A",
            iSCSIPortsDetails['gateway'] || "N/A",
            iSCSIPortsDetails['IP_address_6'] || "N/A",
            iSCSIPortsDetails['prefix_6'] || "N/A",
            iSCSIPortsDetails['gateway_6'] || "N/A",
            iSCSIPortsDetails['MAC'] || "N/A",
            iSCSIPortsDetails['duplex'] || "N/A",
            iSCSIPortsDetails['state'] || "N/A",
            iSCSIPortsDetails['speed'] ? convertToGbps(iSCSIPortsDetails['speed']) : "N/A",
            iSCSIPortsDetails['failover'] || "N/A",
            iSCSIPortsDetails['link_state'] || "N/A",
            iSCSIPortsDetails['host'] || "N/A",
            iSCSIPortsDetails['remote_copy'] || "N/A",
            iSCSIPortsDetails['host_6'] || "N/A",
            iSCSIPortsDetails['remote_copy_6'] || "N/A",
            iSCSIPortsDetails['remote_copy_status'] || "N/A",
            iSCSIPortsDetails['remote_copy_status_6'] || "N/A",
            iSCSIPortsDetails['vlan'] || "N/A",
            iSCSIPortsDetails['vlan_6'] || "N/A",
            iSCSIPortsDetails['adapter_location'] || "N/A",
            iSCSIPortsDetails['adapter_port_id'] || "N/A",
            iSCSIPortsDetails['storage'] || "N/A",
            iSCSIPortsDetails['storage_6'] || "N/A",
            iSCSIPortsDetails['host_port_grp_id'] || "N/A",
            iSCSIPortsDetails['rdma_type'] || "N/A",
            iSCSIPortsDetails['is_rdma_clustering'] || "N/A"
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
 * @label Get IBM FlashSystem5000 iSCSI Ports Information
 * @documentation This procedure retrieves the iSCSI Ports Information of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint)
                .then(function (response) {
                    populateTable(response)
                    D.success(iSCSIPortsTable)
                })
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
