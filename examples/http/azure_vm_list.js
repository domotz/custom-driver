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

// Parameters for Azure authentication
const tenantID = D.getParameter('tenantID');
const client_id = D.getParameter('client_id');
const client_secret = D.getParameter('client_secret');
const subscriptionId = D.getParameter('subscriptionId');

const resourceGroups = D.getParameter('resourceGroups');
const vmNames = D.getParameter('vmNames');

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com');
const azureCloudManagementService = D.createExternalDevice('management.azure.com');

let accessToken;
let vmProperties;
let vmTable;

// This is the list of all allowed performance metrics that can be retrieved from a running VM.
// To include a specific metric for retrieval, move it to the performanceMetrics list, and it will appear dynamically in the output table.
// const allowedPerformanceMetrics = [
//     {label: 'OS Disk Max Burst BW', valueType: D.valueType.NUMBER, key: 'OS Disk Max Burst Bandwidth'},
//     {label: 'OS Disk Target BW', valueType: D.valueType.NUMBER, key: 'OS Disk Target Bandwidth'},
//     {label: 'OS Disk Max Burst IOPS', valueType: D.valueType.NUMBER, key: 'OS Disk Max Burst IOPS'},
//     {label: 'Network In', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network In', callback: convertBytesToGb },
//     {label: 'OS Disk Target IOPS', valueType: D.valueType.NUMBER, key: 'OS Disk Target IOPS'},
//     {label: 'Premium Disk Cache Hit', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium OS Disk Cache Read Hit'},
//     {label: 'Network Out', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network Out', callback: convertBytesToGb },
//     {label: 'Inbound Flows', valueType: D.valueType.NUMBER, key: 'Inbound Flows'},
//     {label: 'Outbound Flows', valueType: D.valueType.NUMBER, key: 'Outbound Flows'},
//     {label: 'Inbound Flow Rate', valueType: D.valueType.NUMBER, key: 'Inbound Flows Maximum Creation Rate'},
//     {label: 'Outbound Flow Rate', valueType: D.valueType.NUMBER, key: 'Outbound Flows Maximum Creation Rate'},
//     {label: 'Premium Disk Miss', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium OS Disk Cache Read Miss'},
//     {label: 'Disk Queue Depth', valueType: D.valueType.NUMBER, key: 'OS Disk Queue Depth'},
//     {label: 'BW Consumed %', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk Bandwidth Consumed Percentage'},
//     {label: 'IOPS Consumed %', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk IOPS Consumed Percentage'},
//     {label: 'Burst BPS Credits %', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk Used Burst BPS Credits Percentage'},
//     {label: 'Burst IO Credits %', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk Used Burst IO Credits Percentage'},
//     {label: 'Temp Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Temp Disk Read Operations/Sec'},
//     {label: 'Temp Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Temp Disk Write Operations/Sec'},
//     {label: 'Temp Disk Queue', valueType: D.valueType.NUMBER, key: 'Temp Disk Queue Depth'},
//     {label: 'Cached BW Consumed', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Cached Bandwidth Consumed Percentage'},
//     {label: 'Cached IOPS %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Cached IOPS Consumed Percentage'},
//     {label: 'Uncached BW %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Uncached Bandwidth Consumed Percentage'},
//     {label: 'Uncached IOPS %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Uncached IOPS Consumed Percentage'},
//     {label: 'Remote Burst IO %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Remote Used Burst IO Credits Percentage'},
//     {label: 'Remote Burst BPS %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Remote Used Burst BPS Credits Percentage'},
//     {label: 'Data Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Data Disk Read Operations/Sec'},
//     {label: 'Data Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Data Disk Write Operations/Sec'},
//     {label: 'Data Disk Queue', valueType: D.valueType.NUMBER, key: 'Data Disk Queue Depth'},
//     {label: 'Data BW Consumed', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk Bandwidth Consumed Percentage'},
//     {label: 'Data IOPS Consumed', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk IOPS Consumed Percentage'},
//     {label: 'Data Disk Target BW', valueType: D.valueType.NUMBER, key: 'Data Disk Target Bandwidth'},
//     {label: 'Data Disk Target IOPS', valueType: D.valueType.NUMBER, key: 'Data Disk Target IOPS'},
//     {label: 'Data Max Burst BW', valueType: D.valueType.NUMBER, key: 'Data Disk Max Burst Bandwidth'},
//     {label: 'Data Max Burst IOPS', valueType: D.valueType.NUMBER, key: 'Data Disk Max Burst IOPS'},
//     {label: 'Burst BPS Credits %', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk Used Burst BPS Credits Percentage'},
//     {label: 'Burst IO Credits %', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk Used Burst IO Credits Percentage'},
//     {label: 'Cache Read Hit', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium Data Disk Cache Read Hit'},
//     {label: 'Cache Read Miss', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium Data Disk Cache Read Miss'},
//     {label: 'Local Burst IO %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Local Used Burst IO Credits Percentage'},
//     {label: 'Local Burst BPS %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Local Used Burst BPS Credits Percentage'}
// ];

// This is the list of selected performance metrics retrieved when a VM is running.
// To exclude a specific metric from this list, move it to the allowedPerformanceMetrics list, and it will no longer appear dynamically in the output table.
const performanceMetrics = [
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
    {label: 'CPU Credits Consumed', valueType: D.valueType.NUMBER,	key: 'CPU Credits Consumed'},
    {label: 'Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Disk Read Operations/Sec'},
    {label: 'Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Disk Write Operations/Sec'},
    {label: 'OS Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'OS Disk Read Operations/Sec'},
    {label: 'OS Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'OS Disk Write Operations/Sec'},
    {label: 'Vm Availability', valueType: D.valueType.NUMBER, key: 'VmAvailabilityMetric'}
]

const vmConfigExtractors = [
    {label: 'OS Name', valueType: D.valueType.STRING, key: 'osName', extract: function (bodyAsJSON) {return bodyAsJSON && bodyAsJSON.osName ? bodyAsJSON.osName : "N/A";}},
    {label: 'OS Version', valueType: D.valueType.STRING, key: 'osVersion', extract: function (bodyAsJSON) {return bodyAsJSON && bodyAsJSON.osVersion ? bodyAsJSON.osVersion : "N/A";}},
    {label: 'Extension Type', valueType: D.valueType.STRING, key: 'type', extract: function (bodyAsJSON) {return bodyAsJSON && bodyAsJSON.vmAgent && bodyAsJSON.vmAgent.extensionHandlers && bodyAsJSON.vmAgent.extensionHandlers.length ? bodyAsJSON.vmAgent.extensionHandlers[0].type : "N/A";}},
    {label: 'Extension Status', valueType: D.valueType.STRING, key: 'statusCode', extract: function (bodyAsJSON) {return bodyAsJSON && bodyAsJSON.vmAgent && bodyAsJSON.vmAgent.extensionHandlers && bodyAsJSON.vmAgent.extensionHandlers.length && bodyAsJSON.vmAgent.extensionHandlers[0].status && bodyAsJSON.vmAgent.extensionHandlers[0].status.code ? bodyAsJSON.vmAgent.extensionHandlers[0].status.code : "N/A";}},
    {label: 'Extension Status msg', valueType: D.valueType.STRING, key: 'statusMessage', extract: function (bodyAsJSON) {return bodyAsJSON && bodyAsJSON.vmAgent && bodyAsJSON.vmAgent.extensionHandlers && bodyAsJSON.vmAgent.extensionHandlers.length && bodyAsJSON.vmAgent.extensionHandlers[0].status && bodyAsJSON.vmAgent.extensionHandlers[0].status.message ? bodyAsJSON.vmAgent.extensionHandlers[0].status.message : "N/A";}},
    {label: 'Power State', valueType: D.valueType.STRING, key: 'displayStatus', extract: function (bodyAsJSON) {return bodyAsJSON && bodyAsJSON.statuses[1] && bodyAsJSON.statuses[1].displayStatus ? bodyAsJSON.statuses[1].displayStatus : "N/A"}}
];

const vmInfoExtractors = [
    {label: 'id', key: "id", extract: function(vm){return sanitize(vm.properties.vmId)}},
    {label: 'Name', valueType: D.valueType.NUMBER, key: 'vmName', extract: function(vm){return vm.name || "N/A" }},
    {label: 'Resource Group', valueType: D.valueType.STRING, key: 'resourceGroup', extract: extractResourceGroup },
    {label: 'OS Type', valueType: D.valueType.STRING, key: 'osType', extract: function(vm){return vm.location || "N/A" }},
    {label: 'Location', valueType: D.valueType.STRING, key: 'location', extract: function(vm){return (vm.properties.hardwareProfile && vm.properties.hardwareProfile.vmSize) || "N/A" }},
    {label: 'Size', valueType: D.valueType.STRING, key: 'size', extract: function(vm){return vm.properties.provisioningState || "N/A" }},
    {label: 'Image Publisher', valueType: D.valueType.STRING, key: 'imagePublisher', extract: function(vm){return (vm.properties.additionalCapabilities && vm.properties.additionalCapabilities.hibernationEnabled) || "N/A" }},
    {label: 'Image', valueType: D.valueType.STRING, key: 'imageOffer', extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.publisher) || "N/A" }},
    {label: 'Image Version', valueType: D.valueType.STRING, key: 'imageVersion', extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.offer) || "N/A" }},
    {label: 'Image SKU', valueType: D.valueType.STRING, key: 'imageSku', extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.exactVersion) || "N/A" }},
    {label: 'Data Disks', valueType: D.valueType.STRING, key: 'dataDisks', extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.sku) || "N/A" }},
    {label: 'Provisioning State', valueType: D.valueType.STRING, key: 'provisioningState', extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.dataDisks &&  vm.properties.storageProfile.dataDisks.length ? vm.properties.storageProfile.dataDisks.join(', ') : "N/A") }},
    {label: 'Hibernation Enabled', valueType: D.valueType.STRING, key: 'hibernationEnabled', extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.osType) || "N/A" }},
    {label: 'Managed Disk', valueType: D.valueType.STRING, key: 'managedDisk', extract: function(vm){return (vm.properties.storageProfile && vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.name) || "N/A" }},
    {label: 'Computer Name', valueType: D.valueType.STRING, key: 'computerName', extract: function(vm){return (vm.properties.osProfile && vm.properties.osProfile.computerName) || "N/A" }},
    {label: 'Network Interfaces', valueType: D.valueType.STRING, key: 'networkInterfaces', extract: extractNetworkInterfaces },
    {label: 'Zone', valueType: D.valueType.STRING, key: 'zone', extract: function(vm){return (vm.zones && vm.zones[0]) || "N/A" }}
];

/**
 * Generates Virtual Machine properties by extracting information from the defined virtualMachineScaleSetInfoExtractors.
 * @returns {Promise} A promise that resolves when Virtual Machine properties are generated.
 * It populates the global variable `virtualMachineScaleSetProperties` and concatenates them with `vmConfigExtractors` and `performanceMetrics`.
 */
function generateVirtualMachineScaleSetProperties() {
    return D.q.all(
        vmInfoExtractors.map(function(extractorInfo) {
            return new Promise(function(resolve) {
                if (extractorInfo.key !== 'id') {
                    resolve({'key': extractorInfo.key, 'label': extractorInfo.label, 'valueType': extractorInfo.valueType, 'unit':extractorInfo.unit ? extractorInfo.unit: null});
                } else {
                    resolve(null);
                }
            });
        })
    ).then(function(results) {
        vmProperties = results.filter(function(result){ return result !== null }).concat(vmConfigExtractors).concat(performanceMetrics);
    });
}

/**
 * Creates a table for displaying Azure Virtual Machine properties.
 */
function createVirtualMachineScaleSetTable() {
    vmTable = vmTable = D.createTable('Azure Virtual Machines', vmProperties.map(function(item){
        const tableDef = {label: item.label, valueType: item.valueType };
        if (item.unit) {
            tableDef.unit = item.unit;
        }
        return tableDef;
    }));
}

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
            return resourceGroups.some(function (group) {
                return group.toLowerCase() === vm.resourceGroup.toLowerCase()
            })
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
        const value = vm[item.key] || "N/A";
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

function extractVmConfig(vmInfo, bodyAsJSON) {
    vmConfigExtractors.map(function(item){
        vmInfo[item.key] = item.extract(bodyAsJSON);
    })
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
            extractVmConfig(vmInfo, bodyAsJSON);
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
        if (performanceInfo.timeseries && performanceInfo.timeseries[0] && performanceInfo.timeseries[0].data) {
            const key = getNonTimeStampKey(performanceInfo.timeseries[0].data);
            vmInfo[performanceInfo.name.value] = key ? performanceInfo.timeseries[0].data[0][key] : "N/A";
        } else {
            vmInfo[performanceInfo.name.value] = "N/A"
        }
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
 * Retrieves performance metrics for a list of virtual machines.
 * @param {Array} vmInfoList - The list of virtual machine information objects.
 * @returns {Promise} - A promise that resolves with an array of virtual machine information objects.
 */
function retrieveVMsPerformanceMetrics(vmInfoList) {
    const performanceKeyGroups = [];
    const maxGroupSize = 20;

    for (let i = 0; i < performanceMetrics.length; i += maxGroupSize) {
        performanceKeyGroups.push(
            performanceMetrics.slice(i, i + maxGroupSize).map(function (metric) {
                return metric.key
            }).join(',')
        );
    }

    const promises = vmInfoList.map(function (vmInfo) {
        const d = D.q.defer();

        if (vmInfo.displayStatus === "VM running") {
            const groupPromises = performanceKeyGroups.map(function(group){
                return new Promise(function(resolve, reject) {
                    const config = generateConfig(
                        "/resourceGroups/" + vmInfo.resourceGroup + "/providers/Microsoft.Compute/virtualMachines/" + vmInfo.vmName + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group + "&timespan=PT1M"
                    );
                    azureCloudManagementService.http.get(config, function(error, response, body) {
                        processVmPerformanceResponse({
                            resolve: resolve,
                            reject: reject
                        }, vmInfo)(error, response, body);
                    });
                });
            });
            D.q.all(groupPromises).then(function()
            {
                d.resolve(vmInfo)
            }).catch(d.reject);
        } else {
            d.resolve(vmInfo);
        }
        return d.promise;
    });
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
        .then(generateVirtualMachineScaleSetProperties)
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
        .then(generateVirtualMachineScaleSetProperties)
        .then(createVirtualMachineScaleSetTable)
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