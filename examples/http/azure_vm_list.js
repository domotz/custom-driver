/**
 * Domotz Custom Driver
 * Name: Azure VMs List
 * Description: Monitor Azure Compute Virtual Machines: this script retrieves information about Virtual Machine.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Name
 *      - Resource Group
 *      - OS
 *      - Location
 *      - Size
 *      - Image Publisher
 *      - Image
 *      - Image Version
 *      - Image SKU
 *      - Data Disks
 *      - Provisioning State
 *      - Hibernation Enabled
 *      - Managed Disk
 *      - Computer Name
 *      - Network Interfaces
 *      - Zone
 *      - Power State
 *      - Network Out Total
 *      - Network In Total
 *      - OS Disk Write
 *      - OS Disk Latency
 *      - Percentage CPU
 *      - OS Disk Read
 *      - Temp Disk Latency
 *      - Temp Disk Read
 *      - Temp Disk Write
 *      - Available Memory
 *      - Disk Read
 *      - Disk Write
 *      - Data Disk Read
 *      - Data Disk Write
 *      - Data Disk Latency
 *      - CPU Credits Remaining
 *      - CPU Credits Consumed
 *
 **/

/**
 * @description tenantID
 * @type STRING
 */
const tenantID = D.getParameter('tenantID');

/**
 * @description client_id
 * @type STRING
 */
const client_id = D.getParameter('client_id');

/**
 * @description client_secret
 * @type SECRET_TEXT
 */
const client_secret = D.getParameter('client_secret');

/**
 * @description subscriptionId
 * @type STRING
 */
const subscriptionId = D.getParameter('subscriptionId');

/**
 * @description resource Groups
 * @type LIST
 */
const resourceGroups = D.getParameter('resourceGroups');

/**
 * @description VM Names
 * @type LIST
 */
const vmNames = D.getParameter('vmNames');

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com');
const azureCloudManagementService = D.createExternalDevice('management.azure.com');

let accessToken;

const performanceMetrics = ["Available Memory Bytes", "Disk Read Bytes", "Disk Write Bytes", "Network Out Total", "Network In Total", "OS Disk Write Bytes/sec", "CPU Credits Remaining", "OS Disk Latency", "Percentage CPU", "OS Disk Read Bytes/sec", "Temp Disk Latency", "Temp Disk Read Bytes/sec", "Temp Disk Write Bytes/sec", "CPU Credits Consumed", "Data Disk Read Bytes/sec", "Data Disk Write Bytes/sec", "Data Disk Latency"]

const vmProperties = [
    {label: 'Name', valueType: D.valueType.NUMBER, key: 'vmName'},
    {label: 'Resource Group', valueType: D.valueType.STRING, key: 'resourceGroup'},
    {label: 'OS', valueType: D.valueType.STRING, key: 'osType'},
    {label: 'Location', valueType: D.valueType.STRING, key: 'location'},
    {label: 'Size', valueType: D.valueType.STRING, key: 'size'},
    {label: 'Image Publisher', valueType: D.valueType.STRING, key: 'imagePublisher'},
    {label: 'Image', valueType: D.valueType.STRING, key: 'imageOffer'},
    {label: 'Image Version', valueType: D.valueType.STRING, key: 'imageVersion'},
    {label: 'Image SKU', valueType: D.valueType.STRING, key: 'imageSku'},
    {label: 'Data Disks', valueType: D.valueType.STRING, key: 'dataDisks'},
    {label: 'Provisioning State', valueType: D.valueType.STRING, key: 'provisioningState'},
    {label: 'Hibernation Enabled', valueType: D.valueType.STRING, key: 'hibernationEnabled'},
    {label: 'Managed Disk', valueType: D.valueType.STRING, key: 'managedDisk'},
    {label: 'Computer Name', valueType: D.valueType.STRING, key: 'computerName'},
    {label: 'Network Interfaces', valueType: D.valueType.STRING, key: 'networkInterfaces'},
    {label: 'Zone', valueType: D.valueType.STRING, key: 'zone'},
    {label: 'Power State', valueType: D.valueType.STRING, key: 'displayStatus'},
    {label: 'Network Out Total', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network Out Total', callback: convertBytesToGb},
    {label: 'Network In Total', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network In Total', callback: convertBytesToGb},
    {label: 'OS Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'OS Disk Write Bytes/sec'},
    {label: 'OS Disk Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'OS Disk Latency'},
    {label: 'Percentage CPU', valueType: D.valueType.NUMBER, unit: '%', key: 'Percentage CPU'},
    {label: 'OS Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'OS Disk Read Bytes/sec'},
    {label: 'Temp Disk Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'Temp Disk Latency'},
    {label: 'Temp Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Temp Disk Read Bytes/sec'},
    {label: 'Temp Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Temp Disk Write Bytes/sec'},
    {label: 'Available Memory', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Available Memory Bytes', callback: convertBytesToGb},
    {label: 'Disk Read', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Disk Read Bytes', callback: convertBytesToGb},
    {label: 'Disk Write', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Disk Write Bytes', callback: convertBytesToGb},
    {label: 'Data Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Data Disk Read Bytes/sec'},
    {label: 'Data Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Data Disk Write Bytes/sec'},
    {label: 'Data Disk Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'Data Disk Latency'},
    {label: 'CPU Credits Remaining', valueType: D.valueType.NUMBER, key: 'CPU Credits Remaining'},
    {label: 'CPU Credits Consumed', valueType: D.valueType.NUMBER,	key: 'CPU Credits Consumed'}
]

const vmTable = D.createTable('Azure Virtual Machines', vmProperties.map(function(item){
    const tableDef = { label: item.label, valueType: item.valueType };
    if (item.unit) {
        tableDef.unit = item.unit;
    }
    return tableDef;
}));

const vmInfoExtractors = [
    { key: "id", extract: function(vm){return sanitize(vm.properties.vmId) }},
    { key: "vmName", extract: function(vm){return vm.name || "N/A" }},
    { key: "resourceGroup", extract: extractResourceGroup },
    { key: "location", extract: function(vm){return vm.location || "N/A" }},
    { key: "size", extract: function(vm){return (vm.properties.hardwareProfile && vm.properties.hardwareProfile.vmSize) || "N/A" }},
    { key: "provisioningState", extract: function(vm){return vm.properties.provisioningState || "N/A" }},
    { key: "hibernationEnabled", extract: function(vm){return (vm.properties.additionalCapabilities && vm.properties.additionalCapabilities.hibernationEnabled) || "N/A" }},
    { key: "imagePublisher", extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.publisher) || "N/A" }},
    { key: "imageOffer", extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.offer) || "N/A" }},
    { key: "imageVersion", extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.exactVersion) || "N/A" }},
    { key: "imageSku", extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.sku) || "N/A" }},
    { key: "dataDisks", extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.dataDisks &&  vm.properties.storageProfile.dataDisks.length() ? vm.properties.storageProfile.dataDisks.join(', ') : "N/A") }},
    { key: "osType", extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.osType) || "N/A" }},
    { key: "managedDisk", extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.name) || "N/A" }},
    { key: "computerName", extract: function(vm){return (vm.properties.osProfile && vm.properties.osProfile.computerName) || "N/A" }},
    { key: "networkInterfaces", extract: extractNetworkInterfaces },
    { key: "zone", extract: function(vm){return (vm.zones && vm.zones[0]) || "N/A" }}
];

/**
 * Extracts network interface IDs from the VM object and returns them as a comma-separated string.
 * @param {Object} vm - The VM object containing network profile information.
 * @returns {string} A comma-separated string of network interface IDs or "N/A" if none are found.
 */
function extractNetworkInterfaces(vm) {
    if (vm.properties.networkProfile && vm.properties.networkProfile.networkInterfaces) {
        return vm.properties.networkProfile.networkInterfaces.map(function (ni){
            const match = ni.id.match(/networkInterfaces\/([^\/]*)$/);
            return match ? match[1] : "N/A";
        }).join(', ');
    }
    return "N/A";
}

/**
 * Extracts the resource group from the VM object.
 * @param {Object} vm - The VM object containing the resource group information in its ID.
 * @returns {string} The name of the resource group, or "N/A" if not found.
 */
function extractResourceGroup(vm) {
    let resourceGroup = "N/A";
    if (vm.id) {
        const resourceGroupMatch = vm.id.match(/\/resourceGroups\/([^\/]*)\//);
        if (resourceGroupMatch && resourceGroupMatch[1]) resourceGroup = resourceGroupMatch[1];
    }
    return resourceGroup;
}

/**
 * Checks for HTTP errors in the response and handles them by triggering appropriate failures.
 * @param {Object} error - The error object returned from the HTTP request.
 * @param {Object} response - The HTTP response object.
 */
function checkHTTPError(error, response) {
    if (error) {
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    } else if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode !== 200) {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Processes the login response from the Azure API and extracts the access token.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processLoginResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (bodyAsJSON.access_token) {
            accessToken = bodyAsJSON.access_token;
            d.resolve();
        } else {
            console.error("Access token not found in response body");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
    }
}

/**
 * Filters the list of VM information by specified resource groups.
 * @param {Array} vmInfoList - A list of VM information objects.
 * @returns {Array} The filtered list of VM information based on resource groups.
 */
function filterVmInfoListByResourceGroups(vmInfoList) {
    if (!(resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all')) {
        return vmInfoList.filter(function (vm) {
            const result =  resourceGroups.some(function (group) {
                return group.toLowerCase() === vm.resourceGroup.toLowerCase()
            });
            return result
        });
    }
    return vmInfoList;
}

/**
 * Filters the list of VM information by specified VM names.
 * @param {Array} vmInfoList - A list of VM information objects.
 * @returns {Array} The filtered list of VM information based on VM names.
 */
function filterVmInfoListByVmNames(vmInfoList) {
    if (!(vmNames.length === 1 && vmNames[0].toLowerCase() === 'all')) {
        return vmInfoList.filter(function (vm) {
            return vmNames.some(function (vmName) {
                return vmName.toLowerCase() === vm.vmName.toLowerCase();
            });
        });
    }
    return vmInfoList;
}

/**
 * Processes the response from the VMs API call, extracts VM data, and populates the table.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processVMsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            D.failure(D.errorType.GENERIC_ERROR)
            d.reject("No VMs found in the response");
            return;
        }
        let vmInfoList = bodyAsJSON.value.map(extractVmInfo);
        if (!vmInfoList.length) {
            console.info('There is no Virtual machine');
        } else {
            vmInfoList = filterVmInfoListByResourceGroups(filterVmInfoListByVmNames(vmInfoList));
        }
        d.resolve(vmInfoList);
    }
}

/**
 * Logs in to the Azure cloud service using OAuth2 credentials.
 * @returns {Promise} A promise that resolves upon successful login.
 */
function login() {
    const d = D.q.defer();
    const config = {
        url: "/" + tenantID + "/oauth2/token", protocol: "https", headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }, form: {
            grant_type: "client_credentials",
            client_id: client_id,
            client_secret: client_secret,
            resource: "https://management.azure.com\/"
        }, rejectUnauthorized: false, jar: true
    };
    azureCloudLoginService.http.post(config, processLoginResponse(d));
    return d.promise;
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
 * Extracts relevant VM information from a VM object returned by the Azure API.
 * @param {Object} vm - The VM object containing various properties, including IDs, hardware profile, and storage profile.
 * @returns {Object|null} An object containing the extracted VM information, or null if the VM object is invalid.
 */
function extractVmInfo(vm) {
    if (!vm || !vm.properties || !vm.properties.vmId) return null;

    const extractedInfo = {};

    vmInfoExtractors.forEach(function(row){
        extractedInfo[row.key] = row.extract(vm);
    });
    return extractedInfo;
}

/**
 * Converts a value from bytes to gigabytes.
 * @param bytesValue - The value in bytes.
 * @returns {string} The value converted to gigabytes, rounded to two decimal places.
 */
function convertBytesToGb(bytesValue) {
    if (bytesValue !== "N/A") {
        return (bytesValue / (1024 * 1024 * 1024)).toFixed(2);
    }
    return bytesValue
}

/**
 * Inserts a VM record into the VM table with the given VM information.
 * @param {Object} vm - The VM information object containing details like VM name, resource group, and performance metrics.
 * @returns {Promise} A promise that resolves when the record has been successfully inserted into the table.
 */
function insertRecord(vm) {
    const d = D.q.defer();

    const recordValues = vmProperties.map(function(item){
        const value = vm[item.key];
        return item.callback ? item.callback(value) : value;
    });

    vmTable.insertRecord(vm.id, recordValues);

    d.resolve();
    return d.promise;
}

/**
 * Generates the HTTP configuration for Azure API calls.
 * @param {string} url - The URL endpoint to which the request is made.
 * @returns {Object} The HTTP configuration object containing the URL, protocol, headers, and other settings.
 */
function generateConfig(url) {
    return {
        url: "/subscriptions/" + subscriptionId + url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken,
        }, rejectUnauthorized: false, jar: true
    };
}

/**
 * Retrieves a list of Azure VMs for the configured or all resource groups.
 * @returns {Promise} A promise that resolves with the VM data upon successful retrieval from the Azure API.
 */
function retrieveVMs() {
    const d = D.q.defer();
    const config = generateConfig("/providers/Microsoft.Compute/virtualMachines?api-version=2021-04-01");
    azureCloudManagementService.http.get(config, processVMsResponse(d));
    return d.promise;
}

/**
 * Processes the VM configuration API response and updates the VM display status.
 * @param {Object} d - The deferred promise object.
 * @param {Object} vmInfo - The VM information object to be updated with display status.
 * @returns {Function} A function to process the HTTP response and update the VM display status.
 */
function processVmConfigResponse(d, vmInfo) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        if (error || response.statusCode !== 200) {
            return;
        }
        try {
            const bodyAsJSON = JSON.parse(body);
            if (!bodyAsJSON.statuses[1].displayStatus) D.failure(D.errorType.GENERIC_ERROR);
            vmInfo.displayStatus = bodyAsJSON && bodyAsJSON.statuses[1] && bodyAsJSON.statuses[1].displayStatus ? bodyAsJSON.statuses[1].displayStatus : "N/A";
            d.resolve(vmInfo);
        } catch (parseError) {
            console.error("Error parsing VM configuration:", parseError);
            d.reject(parseError);
        }
    }
}

/**
 * Retrieves the first key from the given data array that is not a "timeStamp" key.
 * @param {Array} data - The array of data entries where each entry contains key-value pairs.
 * @returns {String|null} The first key that is not "timeStamp", or null if none are found.
 */
function getNonTimeStampKey(data) {
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
 * Extracts performance metrics for a VM and populates the VM info object.
 * @param {Object} performanceInfo - The performance metrics information for the VM.
 * @param {Object} vmInfo - The VM information object to populate with performance metrics.
 */
function extractVmPerformance(performanceInfo, vmInfo) {
    if (performanceInfo.name.value) {
        const key = getNonTimeStampKey(performanceInfo.timeseries[0].data);
        vmInfo[performanceInfo.name.value] = key ? performanceInfo.timeseries[0].data[0][key] : "N/A";
    }
}

/**
 * Processes the response from the VMs API call and populates the table with VM data.
 * @param {Object} d - The deferred promise object.
 * @param {Object} vmInfo - The VM information object containing resource group and VM details.
 * @returns {Function} A function to process the HTTP response.
 */
function processVmPerformanceResponse(d, vmInfo) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        if (error || response.statusCode !== 200) {
            return;
        }
        try {
            const bodyAsJSON = JSON.parse(body);

            if (!bodyAsJSON.value) {
                D.failure(D.errorType.GENERIC_ERROR)
                return;
            }
            bodyAsJSON.value.map(function (performanceInfo) {
                extractVmPerformance(performanceInfo, vmInfo)
            });
            d.resolve(vmInfo);
        } catch (parseError) {
            console.error("Error parsing VM configuration:", parseError);
            d.reject("Failed to parse response for " + vmInfo.vmName);
        }
    }
}

/**
 * Retrieves the configuration of Azure VMs for the configured or all resource groups.
 * @param {Array} vmInfoList - A list of VM information objects, each containing details like resource group and VM name.
 * @returns {Promise} A promise that resolves when the configuration for all VMs has been retrieved.
 */
function retrieveVMsConfiguration(vmInfoList) {
    const promises = vmInfoList.map(function (vmInfo) {
        const d = D.q.defer();
        const config = generateConfig("/resourceGroups/" + vmInfo.resourceGroup + "/providers/Microsoft.Compute/virtualMachines/" + vmInfo.vmName + "/instanceView?api-version=2024-07-01");
        azureCloudManagementService.http.get(config, processVmConfigResponse(d, vmInfo));
        return d.promise;
    })
    return D.q.all(promises);
}

/**
 * Initializes the performance metrics for a VM, setting default values as "N/A".
 * @param {Object} vmInfo - The VM information object to initialize with default performance values.
 */
function initPerformances(vmInfo) {
    vmInfo["Network Out Total"] = "N/A"
    vmInfo["Network In Total"] = "N/A"
    vmInfo["OS Disk Write Bytes/sec"] = "N/A"
    vmInfo["OS Disk Latency"] = "N/A"
    vmInfo["Percentage CPU"] = "N/A"
    vmInfo["OS Disk Read Bytes/sec"] = "N/A"
    vmInfo["Temp Disk Latency"] = "N/A"
    vmInfo["Temp Disk Read Bytes/sec"] = "N/A"
    vmInfo["Temp Disk Write Bytes/sec"] = "N/A"
    vmInfo["Available Memory Bytes"] = "N/A"
    vmInfo["Disk Read Bytes"] = "N/A"
    vmInfo["Disk Write Bytes"] = "N/A"
    vmInfo["Data Disk Read Bytes/sec"] = "N/A"
    vmInfo["Data Disk Write Bytes/sec"] = "N/A"
    vmInfo["Data Disk Latency"] = "N/A"
    vmInfo["CPU Credits Remaining"] = "N/A"
    vmInfo["CPU Credits Consumed"] = "N/A"
}

/**
 * Retrieves performance metrics for Azure VMs from the configured or all resource groups.
 * It collects metrics for VMs that are currently running.
 * @param {Array} vmInfoList - A list of VM information objects, each containing details like resource group, VM name, and display status.
 * @returns {Promise} A promise that resolves when performance metrics for all VMs have been retrieved or resolved.
 */
function retrieveVMsPerformanceMetrics(vmInfoList) {
    const promises = vmInfoList.map(function (vmInfo) {
        const d = D.q.defer();
        if (vmInfo.displayStatus === "VM running") {
            const config = generateConfig("/resourceGroups/" + vmInfo.resourceGroup + "/providers/Microsoft.Compute/virtualMachines/" + vmInfo.vmName + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + performanceMetrics.join(',') + "&timespan=PT1M");
            azureCloudManagementService.http.get(config, processVmPerformanceResponse(d, vmInfo));
            return d.promise;
        } else {
            initPerformances(vmInfo)
            d.resolve(vmInfo);
            return d.promise;
        }
    })
    return D.q.all(promises);
}

/**
 * Populates all VMs into the output table by calling insertRecord for each VM in the list.
 * @param {Array} vmInfoList - A list of VM information objects to be inserted into the table.
 * @returns {Promise} A promise that resolves when all records have been inserted into the table.
 */
function populateTable(vmInfoList) {
    const promises = vmInfoList.map(insertRecord);
    return D.q.all(promises);
}

/**
 * Publishes the VM table.
 */
function publishVMTable() {
    D.success(vmTable);
}

/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(retrieveVMs)
        .then(retrieveVMsConfiguration)
        .then(retrieveVMsPerformanceMetrics)
        .then(function () {
            D.success();
        })
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Azure VMs
 * @documentation This procedure is used to extract Azure VMs.
 */
function get_status() {
    login()
        .then(retrieveVMs)
        .then(retrieveVMsConfiguration)
        .then(retrieveVMsPerformanceMetrics)
        .then(populateTable)
        .then(publishVMTable)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}