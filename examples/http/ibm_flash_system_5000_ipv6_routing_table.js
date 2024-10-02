/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 IPv6 routing table
 * Description: Monitors the IPv6 routing table of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Destination
 *      - Gateway
 *      - Flag
 *      - Metric
 *      - Reference
 *      - Use
 *      - Interface
 *
 **/

const endpointDetails = {
    "endpoint": "lsroute"
}

let entryCounter = 1

let routingInfoList = []

const routingInfoTable = D.createTable(
    'Routing Information Details',
    [
        {label: "Destination", valueType: D.valueType.STRING},
        {label: "Gateway", valueType: D.valueType.STRING},
        {label: "Flag", valueType: D.valueType.STRING},
        {label: "Metric", valueType: D.valueType.NUMBER},
        {label: "Reference", valueType: D.valueType.STRING},
        {label: "Use", valueType: D.valueType.NUMBER},
        {label: "Interface", valueType: D.valueType.STRING},
    ]
);

/**
 * Sends an HTTPS POST request and returns the parsed JSON response.
 * @param {string} endpoint - The API endpoint.
 * @param {Object} headers - The request headers.
 * @param callBack
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttps(endpoint, headers, callBack) {
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
        } else if (response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            let response = body;
            if (callBack) {
                response = callBack(body)
            }
            d.resolve(response);
        }
    })
    return d.promise
}

function convertToJson(stringObject) {
    return JSON.parse(stringObject)
}

/**
 * Calls an HTTPS endpoint with an authentication token.
 * @param {string} token - Auth token for the request.
 * @param {string} endpoint - The API endpoint.
 * @returns {Promise<Object>} Parsed JSON response.
 */
function callHttpsEndpoint(token, endpoint) {
    const headers = {"X-Auth-Token": token}
    return callHttps(endpoint, headers, null)
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
    return callHttps(endpoint, headers, convertToJson)
}

/**
 * Populates the IPv6 routing table with details from a list.
 */
function populateTable() {
    for (let i = 0; i < routingInfoList.length; i++) {
        const routingDetails = routingInfoList[i];
        routingInfoTable.insertRecord((i + 1).toString(), [
            routingDetails['destination'] || "N/A",
            routingDetails['gateway'] || "N/A",
            routingDetails['flag'] || "N/A",
            routingDetails['metric'] || 0,
            routingDetails['reference'] || "N/A",
            routingDetails['use'] || 0,
            routingDetails['interface'] || "N/A",
        ]);
    }
}

/**
 * Creates an empty entry with default values and a unique ID.
 * @returns {Object} An object representing an empty entry with default values.
 */
function createEmptyEntry() {
    return {
        id: entryCounter++,
        destination: "N/A",
        gateway: "N/A",
        flag: "N/A",
        metric: "N/A",
        reference: "N/A",
        use: "N/A",
        interface: "N/A",
    };
}

/**
 * Extracts the interface and destination (next hop) from a given string.
 * @param {string} string - The input string containing the interface and next hop information.
 * @returns {Array} An array where the first element is the interface and the second is the destination (next hop).
 */
function extractInterfaceAndNextHop(string) {
    if (string) {
        const match = string.match(/([a-zA-Z]+)(.*)/);
        if (match) {
            const interface = match[1];
            const destination = match[2].replace(/^0+/, '0');
            return [interface, destination.trim()];
        }
    }
    return ['N/A', 'N/A'];
}

/**
 * Updates the entry object based on the current keyword in the routing entries.
 * @param {Object} entry - The entry object to be updated.
 * @param {Array<string>} routingEntries - Array of routing entry keywords and values.
 * @returns {number} The updated index after processing the keyword and its associated value.
 */
function updateRoutingEntry(entry, routingEntries) {
    if (routingEntries.length > 5) {
        entry.destination = routingEntries[0];
        entry.gateway = routingEntries[1];
        entry.flag = routingEntries[2];
        entry.metric = routingEntries[3];
        entry.reference = routingEntries[4];
        entry.use = routingEntries[5];
        const interfaceAndNextHop = extractInterfaceAndNextHop(routingEntries[6])
        entry.interface = interfaceAndNextHop[0];
        routingInfoList.push(entry)
        routingEntries = routingEntries.splice(6)
        routingEntries[0] = interfaceAndNextHop[1];
        recursiveRoutingEntryExtraction(routingEntries);
    }
}

/**
 * Recursively processes routing entries, extracting relevant data and updating an entry object.
 * @param {Array<string>} routingEntries - Array of routing entry keywords and values.
 * @returns {Promise} A promise that resolves when all routing entries are processed.
 */
function recursiveRoutingEntryExtraction(routingEntries) {
    const d = D.q.defer();
    let newEntry = createEmptyEntry();
    if (routingEntries.length) {
        updateRoutingEntry(newEntry, routingEntries);
        d.resolve();
    } else {
        d.resolve();
    }
    return d.promise
}

/**
 * Parses the routing table from the routing output and processes routing entries.
 * If the IPv6 routing table section is found, it extracts and processes the IPv6 routing information.
 * @param {string} routingOutput - The raw output of the routing table.
 * @returns {Promise} A promise that resolves when the routing table is successfully parsed and processed.
 */
function parseRoutingTable(routingOutput) {
    const d = D.q.defer();
    const ipv6RoutingTableMarker = "Kernel IPv6 routing table";
    const ipv6RoutingTableIndex = routingOutput.indexOf(ipv6RoutingTableMarker) + ipv6RoutingTableMarker.length;
    if (ipv6RoutingTableIndex !== -1) {
        const routingInfo = (routingOutput.substring(ipv6RoutingTableIndex)).trim();
        let routingEntries = routingInfo.split(/\s+/);
        routingEntries = routingEntries.splice(7)
        routingEntries[0] = routingEntries[0].replace("If", "")
        recursiveRoutingEntryExtraction(routingEntries).then(function () {
            d.resolve();
        }).catch(function (error) {
            d.reject(error);
        });
    } else {
        console.log("String not found in the output.");
        d.resolve();
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
 * @label Get IBM FlashSystem5000 IPv6 routing table
 * @documentation This procedure retrieves the IPv6 routing table of the IBM FlashSystem5000
 */
function get_status() {
    login()
        .then(function (body) {
            return callHttpsEndpoint(body.token, "/rest/" + endpointDetails.endpoint); // Return the endpoint call as a promise
        })
        .then(function (response) {
            return parseRoutingTable(response);
        })
        .then(function () {
            populateTable();
            D.success(routingInfoTable);
        })
        .catch(function (error) {
            console.error('Validation failed: ', error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
