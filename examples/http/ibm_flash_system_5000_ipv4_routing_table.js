/**
 * Domotz Custom Driver
 * Name: IBM FlashSystem5000 IPv4 routing table
 * Description: Monitors the IPv4 routing table of the IBM FlashSystem5000.
 *
 * Communication protocol is HTTPS
 *
 * Tested on FlashSystem5000 version: 8.5.0.6
 *
 * Extracts the following information from the data array:
 *      - Destination
 *      - Gateway
 *      - Interface
 *      - Table
 *      - Protocol
 *      - Source IP
 *      - Scope
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
        {label: "Interface", valueType: D.valueType.STRING},
        {label: "Table", valueType: D.valueType.STRING},
        {label: "Protocol", valueType: D.valueType.STRING},
        {label: "Source IP", valueType: D.valueType.STRING},
        {label: "Scope", valueType: D.valueType.STRING}
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
 * Populates the IPv4 routing table with details from a list.
 */
function populateTable() {
    for (let i = 0; i < routingInfoList.length; i++) {
        const routingDetails = routingInfoList[i];
        routingInfoTable.insertRecord((i + 1).toString(), [
            routingDetails['destination'] || "N/A",
            routingDetails['gateway'] || "N/A",
            routingDetails['interface'] || "N/A",
            routingDetails['table'] || "N/A",
            routingDetails['protocol'] || "N/A",
            routingDetails['sourceIP'] || "N/A",
            routingDetails['scope'] || "N/A"
        ]);
    }
}


/**
 * Finds the index of the last character of the first IP address in the string.
 * @param {string} str - The input string to search for an IP address.
 * @returns {number} The index of the last character of the IP address, or -1 if no valid IP address is found.
 */
function getLastCharIndexOfIP(str) {
    const ipPattern = /(\d{1,3}\.){3}\d{1,3}/;
    const match = str.match(ipPattern);

    if (match) {
        const ipAddress = match[0];
        return str.indexOf(ipAddress) + ipAddress.length - 1;
    }
    return -1;
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
        interface: "N/A",
        table: "N/A",
        protocol: "N/A",
        sourceIP: "N/A",
        scope: "N/A"
    };
}

/**
 * Updates the entry object based on the current keyword in the routing entries.
 * @param {Object} entry - The entry object to be updated.
 * @param {Array<string>} routingEntries - Array of routing entry keywords and values.
 * @param {number} index - The current index in the routingEntries array.
 * @returns {number} The updated index after processing the keyword and its associated value.
 */
function updateEntryBasedOnKeyword(entry, routingEntries, index) {
    switch (routingEntries[index]) {
        case "via":
            entry.gateway = routingEntries[index + 1];
            return index + 2;
        case "dev":
            entry.interface = routingEntries[index + 1];
            return index + 2;
        case "table":
            entry.table = routingEntries[index + 1];
            return index + 2;
        case "proto":
            entry.protocol = routingEntries[index + 1];
            return index + 2;
        case "scope":
            entry.scope = routingEntries[index + 1];
            return index + 2;
        case "src":
            return processSourceIP(entry, routingEntries, index);
        default:
            return index;
    }
}

/**
 * Processes the source IP in the routing entries and updates the entry object.
 * If additional routing data remains after the IP, it will recursively extract further entries.
 * @param {Object} entry - The entry object to be updated with the source IP.
 * @param {Array<string>} routingEntries - Array of routing entry keywords and values.
 * @param {number} index - The current index in the routingEntries array.
 * @returns {number} The updated index after processing the source IP.
 */
function processSourceIP(entry, routingEntries, index) {
    let lastCharIndexOfIP = getLastCharIndexOfIP(routingEntries[index + 1]);
    if (lastCharIndexOfIP !== -1) {
        entry.sourceIP = routingEntries[index + 1].substring(0, lastCharIndexOfIP + 1);
        routingEntries[index + 1] = routingEntries[index + 1].substring(lastCharIndexOfIP + 1);

        if (routingEntries[index + 1].trim() === '') {
            return index + 2;
        }
        routingInfoList.push(entry)
        routingEntries = routingEntries.splice(index + 1)
        if (routingEntries.length > 0) {
            recursiveRoutingEntryExtraction(routingEntries);
            return routingEntries.length
        }
    }
    return index + 1;
}

/**
 * Recursively processes routing entries, extracting relevant data and updating an entry object.
 * @param {Array<string>} routingEntries - Array of routing entry keywords and values.
 * @returns {Promise} A promise that resolves when all routing entries are processed.
 */
function recursiveRoutingEntryExtraction(routingEntries) {
    const d = D.q.defer();

    let newEntry = createEmptyEntry();

    for (let i = 0; i < routingEntries.length; i++) {
        if (i === 0) {
            newEntry.destination = routingEntries[i];
        } else {
            i = updateEntryBasedOnKeyword(newEntry, routingEntries, i);
            if (i === routingEntries.length) {
                d.resolve();
            }
        }
    }
    return d.promise
}

/**
 * Parses the routing table from the routing output and processes routing entries.
 * If the IPv6 routing table section is found, it extracts and processes the IPv4 routing information.
 * @param {string} routingOutput - The raw output of the routing table.
 * @returns {Promise} A promise that resolves when the routing table is successfully parsed and processed.
 */
function parseRoutingTable(routingOutput) {
    const d = D.q.defer();
    const ipv6RoutingTableIndex = routingOutput.indexOf("Kernel IPv6 routing tableDestination");
    if (ipv6RoutingTableIndex !== -1) {
        const routingInfo = routingOutput.substring(0, ipv6RoutingTableIndex).trim();
        const routingEntries = routingInfo.split(/\s+/);
        recursiveRoutingEntryExtraction(routingEntries).then(function () {
            d.resolve();
        })
            .catch(function (error) {
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
 * @label Get IBM FlashSystem5000 IPv4 routing table
 * @documentation This procedure retrieves the IPv4 routing table of the IBM FlashSystem5000
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
