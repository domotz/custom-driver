/**
 * Domotz Custom Driver
 * Name: Azure Network Interfaces
 * Description: This script retrieves information about network interfaces and their associated performance metrics
 *
 * Communication protocol is HTTPS
 *
 * Creates Custom Driver table with the following columns:
 *      - Resource Group
 *      - Provisioning State
 *      - Resource GUID
 *      - IP Configuration Name
 *      - IP Config Provisioning State
 *      - Private IP Address
 *      - IP Allocation Method
 *      - Primary IP Configuration
 *      - Private IP Version
 *      - DNS servers
 *      - Applied DNS servers
 *      - Internal Domain Name Suffix
 *      - MAC Address
 *      - Accelerated Networking
 *      - Virtual Network Encryption
 *      - IP Forwarding
 *      - Disable TCP State Tracking
 *      - Network Security Group
 *      - Primary Network Interface
 *      - Associated Virtual Machine
 *      - NIC Type
 *      - Location
 *      - Kind
 *      - Bytes Sent
 *      - Bytes Received
 *      - Packets Sent
 *      - Packets Received
 *
 **/

const tenantId = D.getParameter('tenantId')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')
const subscriptionId = D.getParameter('subscriptionId')

const resourceGroups = D.getParameter('resourceGroups')
const vmNames = D.getParameter('vmNames')

// Define external devices for Azure login and management services
const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com')
const azureCloudManagementService = D.createExternalDevice('management.azure.com')

let accessToken
let networkInterfacesProperties;
let networkInterfacesTable;

// This is the list of all allowed performance metrics that can be retrieved.
// To include a specific metric for retrieval, move it to the performanceMetrics list, and it will appear dynamically in the output table.
// const allowedPerformanceMetrics = []

// Performance metrics to retrieve from Azure
// This array contains the names of specific performance metrics related to network interfaces
const performanceMetrics = [{
    label: 'Bytes Sent',
    unit: "B",
    valueType: D.valueType.NUMBER,
    key: "BytesSentRate"
}, {
    label: 'Bytes Received',
    unit: "B",
    valueType: D.valueType.NUMBER,
    key: "BytesReceivedRate"
}, {label: 'Packets Sent', valueType: D.valueType.NUMBER, key: "PacketsSentRate"}, {
    label: 'Packets Received',
    valueType: D.valueType.NUMBER,
    key: "PacketsReceivedRate"
}]

const networkInterfaceInfoExtractors = [{
    key: "id", extract: function (networkInterface) {
        return sanitize(networkInterface.name)
    }
}, {
    label: "Resource Group",
    valueType: D.valueType.STRING,
    key: "resourceGroupName",
    extract: function (networkInterface) {
        if (networkInterface.id) {
            const matches = networkInterface.id.match(/resourceGroups\/([^/]+)/);
            return matches ? matches[1] : "N/A";
        }
        return "N/A";
    }
}, {
    label: "Provisioning State",
    valueType: D.valueType.STRING,
    key: "provisioningState",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.provisioningState || "N/A";
    }
}, {
    label: "Resource GUID", valueType: D.valueType.STRING, key: "resourceGuid", extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.resourceGuid || "N/A";
    }
}, {
    label: "IP Configuration Name",
    valueType: D.valueType.STRING,
    key: "ipConfigurationName",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.ipConfigurations && networkInterface.properties.ipConfigurations[0] && networkInterface.properties.ipConfigurations[0].name || "N/A";
    }
}, {
    label: "IP Config Provisioning State",
    valueType: D.valueType.STRING,
    key: "ipConfigProvisioningState",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.ipConfigurations && networkInterface.properties.ipConfigurations[0] && networkInterface.properties.ipConfigurations[0].properties && networkInterface.properties.ipConfigurations[0].properties.provisioningState || "N/A";
    }
}, {
    label: "Private IP Address",
    valueType: D.valueType.STRING,
    key: "privateIPAddress",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.ipConfigurations && networkInterface.properties.ipConfigurations[0] && networkInterface.properties.ipConfigurations[0].properties && networkInterface.properties.ipConfigurations[0].properties.privateIPAddress || "N/A";
    }
}, {
    label: "IP Allocation Method",
    valueType: D.valueType.STRING,
    key: "ipAllocationMethod",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.ipConfigurations && networkInterface.properties.ipConfigurations[0] && networkInterface.properties.ipConfigurations[0].properties && networkInterface.properties.ipConfigurations[0].properties.privateIPAllocationMethod || "N/A";
    }
}, {
    label: "Primary IP Configuration",
    valueType: D.valueType.STRING,
    key: "primaryIpConfiguration",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.ipConfigurations && networkInterface.properties.ipConfigurations[0] && networkInterface.properties.ipConfigurations[0].properties && networkInterface.properties.ipConfigurations[0].properties.primary || "N/A";
    }
}, {
    label: "Private IP Version",
    valueType: D.valueType.STRING,
    key: "privateIPAddressVersion",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.ipConfigurations && networkInterface.properties.ipConfigurations[0] && networkInterface.properties.ipConfigurations[0].properties && networkInterface.properties.ipConfigurations[0].properties.privateIPAddressVersion || "N/A";
    }
}, {
    label: "DNS servers", valueType: D.valueType.STRING, key: "dnsServers", extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.dnsSettings && networkInterface.properties.dnsSettings.dnsServers ? networkInterface.properties.dnsSettings.dnsServers.join(", ") : "N/A";
    }
}, {
    label: "Applied DNS servers",
    valueType: D.valueType.STRING,
    key: "appliedDnsServers",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.dnsSettings && networkInterface.properties.dnsSettings.appliedDnsServers ? networkInterface.properties.dnsSettings.appliedDnsServers.join(", ") : "N/A";
    }
}, {
    label: "nternal Domain Name Suffix",
    valueType: D.valueType.STRING,
    key: "internalDomainNameSuffix",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.dnsSettings && networkInterface.properties.dnsSettings.internalDomainNameSuffix || "N/A";
    }
}, {
    label: "MAC Address", valueType: D.valueType.STRING, key: "macAddress", extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.macAddress || "N/A";
    }
}, {
    label: "Accelerated Networking",
    valueType: D.valueType.STRING,
    key: "enableAcceleratedNetworking",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.enableAcceleratedNetworking || "N/A";
    }
}, {
    label: "Virtual Network Encryption",
    valueType: D.valueType.STRING,
    key: "vnetEncryptionSupported",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.vnetEncryptionSupported || "N/A";
    }
}, {
    label: "IP Forwarding",
    valueType: D.valueType.STRING,
    key: "enableIPForwarding",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.enableIPForwarding || "N/A";
    }
}, {
    label: "Disable TCP State Tracking",
    valueType: D.valueType.STRING,
    key: "disableTcpStateTracking",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.disableTcpStateTracking || "N/A";
    }
}, {
    label: "Network Security Group",
    valueType: D.valueType.STRING,
    key: "networkSecurityGroup",
    extract: function (networkInterface) {
        if (networkInterface.properties && networkInterface.properties.networkSecurityGroup && networkInterface.properties.networkSecurityGroup.id) {
            const matches = networkInterface.properties.networkSecurityGroup.id.match(/networkSecurityGroups\/([^/]+)/);
            return matches ? matches[1] : "N/A";
        }
        return "N/A";
    }
}, {
    label: "Primary Network Interface",
    valueType: D.valueType.STRING,
    key: "primaryNetworkInterface",
    extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.primary || "N/A";
    }
}, {
    label: "Associated Virtual Machine",
    valueType: D.valueType.STRING,
    key: "associatedVirtualMachine",
    extract: function (networkInterface) {
        if (networkInterface.properties && networkInterface.properties.virtualMachine && networkInterface.properties.virtualMachine.id) {
            const matches = networkInterface.properties.virtualMachine.id.match(/virtualMachines\/([^/]+)/);
            return matches ? matches[1] : "N/A";
        }
        return "N/A";
    }
}, {
    label: "NIC Type", valueType: D.valueType.STRING, key: "nicType", extract: function (networkInterface) {
        return networkInterface.properties && networkInterface.properties.nicType || "N/A";
    }
}, {
    label: "Location", valueType: D.valueType.STRING, key: "location", extract: function (networkInterface) {
        return networkInterface.location || "N/A";
    }
}, {
    label: "Kind", valueType: D.valueType.STRING, key: "kind", extract: function (networkInterface) {
        return networkInterface.kind || "N/A";
    }
}];

/**
 * Generates network interface properties by extracting information from the defined virtualMachineScaleSetInfoExtractors.
 * @returns {Promise} A promise that resolves when network interface properties are generated.
 * It populates the global variable `virtualMachineScaleSetProperties` and concatenates them with `networkInterfaceInfoExtractors` and `performanceMetrics`.
 */
function generateNetworkInterfaceProperties() {
    return D.q.all(networkInterfaceInfoExtractors.map(function (extractorInfo) {
        return new Promise(function (resolve) {
            if (extractorInfo.key !== 'id') {
                resolve({
                    'key': extractorInfo.key,
                    'label': extractorInfo.label,
                    'valueType': extractorInfo.valueType,
                    'unit': extractorInfo.unit ? extractorInfo.unit : null
                });
            } else {
                resolve(null);
            }
        });
    })).then(function (results) {
        networkInterfacesProperties = results.filter(function (result) {
            return result !== null
        }).concat(performanceMetrics);
    });
}

/**
 * Creates a table for displaying Azure network interface properties.
 */
function createNetworkInterfaceTable() {
    networkInterfacesTable = D.createTable('Network Interfaces Table', networkInterfacesProperties.map(function (item) {
        const tableDef = {label: item.label, valueType: item.valueType};
        if (item.unit) {
            tableDef.unit = item.unit;
        }
        return tableDef;
    }));
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
            console.error("Access token not found in response body")
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        }
    }
}

/**
 * Filters the network interfaces based on the provided VM names and resource groups
 * @param {Array} networkInterfaces The list of network interfaces to filter
 * @returns {Array} The filtered list of network interfaces
 */
function filterNetworkInterfaces(networkInterfaces) {
    return networkInterfaces.filter(function (networkInterface) {
        const associatedVM = networkInterface.associatedVirtualMachine
        const resourceGroupName = networkInterface.resourceGroupName
        const vmFilter = (vmNames.length === 1 && vmNames[0].toLowerCase() === 'all') || vmNames.some(function (vmName) {
            return vmName.toLowerCase() === associatedVM.toLowerCase()
        })
        const rgFilter = (resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') || resourceGroups.some(function (resourceGroup) {
            return resourceGroup.toLowerCase() === resourceGroupName.toLowerCase()
        })
        return vmFilter && rgFilter
    })
}

/**
 * Processes the response containing network interfaces, filtering and resolving the data
 * @param {Object} d The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processNetworkInterfacesResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (Array.isArray(bodyAsJSON.value) && bodyAsJSON.value.length > 0) {
            const networkInterfaces = bodyAsJSON.value.map(extractNetworkInterfacesInfo)
            const filteredInterfaces = filterNetworkInterfaces(networkInterfaces)
            d.resolve(filteredInterfaces)
        } else {
            console.error("No Network Interfaces found")
            D.failure(D.errorType.GENERIC_ERROR)
        }
    }
}

/**
 * Processes the performance metrics response for a network interface
 * @param {Object} d  The deferred promise object
 * @param networkInterfaceInfo
 * @returns {Function} A function to process the HTTP response
 */
function processNIPerformanceMetricsResponse(d, networkInterfaceInfo) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body)
        if (Array.isArray(bodyAsJSON.value) && bodyAsJSON.value.length > 0) {
            bodyAsJSON.value.map(function (performanceInfo) {
                extractMetricsInfo(performanceInfo, networkInterfaceInfo)
            });
            d.resolve(networkInterfaceInfo);
        } else {
            console.error("No performance metrics found for the network interface")
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
        url: "/" + tenantId + "/oauth2/token", protocol: "https", headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }, form: {
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
            resource: "https://management.azure.com\/"
        }, rejectUnauthorized: false, jar: true
    }
    azureCloudLoginService.http.post(config, processLoginResponse(d))
    return d.promise
}

/**
 * Extracts information from a network interface object
 * @param {Object} networkInterface  The network interface object to extract data from
 * @returns {Object} An object containing extracted network interface information
 */
function extractNetworkInterfacesInfo(networkInterface) {
    if (!networkInterface || !networkInterface.name) return null;
    const extractedInfo = {};
    networkInterfaceInfoExtractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(networkInterface);
    });
    return extractedInfo;
}

/**
 * Retrieves the first non-time series key from the data.
 * @param {Array} data - The array of data objects.
 * @returns {string|null} The first non-time series key, or null if not found.
 */
function getNonTimeSeriesKey(data) {
    if (!data || data.length === 0) {
        return null;
    }
    const entry = data[0];
    for (const key in entry) {
        if (key !== "timeStamp") {
            return key;
        }
    }
    return null;
}

/**
 * Extracts performance data and updates the disk information.
 * @param {Object} performanceInfo - The performance information object.
 * @param {Object} networkInterfaceInfo - The disk information to update.
 */
function extractMetricsInfo(performanceInfo, networkInterfaceInfo) {
    if (performanceInfo.name.value) {
        if (performanceInfo.timeseries && performanceInfo.timeseries[0] && performanceInfo.timeseries[0].data) {
            const key = getNonTimeSeriesKey(performanceInfo.timeseries[0].data);
            networkInterfaceInfo[performanceInfo.name.value] = key ? performanceInfo.timeseries[0].data[0][key] : "N/A";
        } else {
            networkInterfaceInfo[performanceInfo.name.value] = "N/A"
        }
    }
}


/**
 * Inserts a record into the networkInterfaces table.
 * @param {Object} networkInterfaces - The networkInterfaces information to insert into the table.
 * @returns {Promise} A promise that resolves when the record is inserted.
 */
function insertRecord(networkInterfaces) {
    const d = D.q.defer();
    const recordValues = networkInterfacesProperties.map(function (item) {
        const value = networkInterfaces[item.key] || "N/A";
        return item.callback ? item.callback(value) : value;
    });
    networkInterfacesTable.insertRecord(networkInterfaces.id, recordValues);
    d.resolve();
    return d.promise;
}

/**
 * Generates the configuration object for making API requests to Azure
 * @param {string} url  The API endpoint to access
 * @returns {Object} The configuration object for the HTTP request
 */
function generateConfig(url) {
    return {
        url: "/subscriptions/" + subscriptionId + url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken,
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieves network interfaces from the Azure cloud service
 * @returns {Promise} A promise that resolves with the list of network interfaces
 */
function retrieveNetworkInterfaces() {
    const d = D.q.defer()
    const config = generateConfig("/providers/Microsoft.Network/networkInterfaces?api-version=2023-02-01")
    azureCloudManagementService.http.get(config, processNetworkInterfacesResponse(d))
    return d.promise
}

/**
 * Retrieves performance metrics for the specified network interfaces
 * @param {Array} networkInterfaceList  The list of network interfaces to get metrics for
 * @returns {Promise} A promise that resolves with a list of performance metrics
 */
function retrieveNIPerformanceMetrics(networkInterfaceList) {
    const performanceKeyGroups = [];
    const maxGroupSize = 20;
    for (let i = 0; i < performanceMetrics.length; i += maxGroupSize) {
        performanceKeyGroups.push(performanceMetrics.slice(i, i + maxGroupSize).map(function (metric) {
            return metric.key
        }).join(','));
    }
    const promises = networkInterfaceList.map(function (networkInterface) {
        const d = D.q.defer();
        const groupPromises = performanceKeyGroups.map(function (group) {
            return new Promise(function () {
                const config = generateConfig("/resourceGroups/" + networkInterface.resourceGroupName + "/providers/Microsoft.Network/networkInterfaces/" + networkInterface.id + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group + "&timespan=PT1M");
                azureCloudManagementService.http.get(config, processNIPerformanceMetricsResponse(d, networkInterface));
            });
        });
        D.q.all(groupPromises).then(function () {
            d.resolve(networkInterface)
        }).catch(d.reject);
        return d.promise;
    });
    return D.q.all(promises);
}

/**
 * Populates all disks into the output table by calling insertRecord for each Disk in the list.
 * @param {Array} networkInterfaceList - A list of Disk information objects to be inserted into the table.
 * @returns {Promise} A promise that resolves when all records have been inserted into the table.
 */
function populateTable(networkInterfaceList) {
    const promises = networkInterfaceList.map(insertRecord);
    return D.q.all(promises);
}

/**
 * Publishes the Disks table.
 */
function publishNetworkInterfacesTable() {
    D.success(networkInterfacesTable);
}


/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(generateNetworkInterfaceProperties)
        .then(retrieveNetworkInterfaces)
        .then(retrieveNIPerformanceMetrics)
        .then(function () {
            D.success();
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Azure Network Interfaces
 * @documentation This procedure is used to extract Azure network interfaces and their performance metrics
 */
function get_status() {
    login()
        .then(generateNetworkInterfaceProperties)
        .then(createNetworkInterfaceTable)
        .then(retrieveNetworkInterfaces)
        .then(retrieveNIPerformanceMetrics)
        .then(populateTable)
        .then(publishNetworkInterfacesTable)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}