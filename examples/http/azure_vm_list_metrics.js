/**
 * Domotz Custom Driver
 * Name: Azure Virtual Machines List Metrics
 * Description: Monitor Azure Compute Virtual Machines Metrics: this script retrieves information about Virtual Machine Performance Metrics.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Name
 *      - Resource Group
 *      - OS Name
 *      - OS Version
 *      - Extension Type
 *      - Extension Status
 *      - Extension Status msg
 *      - Power State
 *      - Network Out Total
 *      - Network In Total
 *      - Available Memory
 *      - Percentage CPU
 *      - CPU Credits Remaining
 *      - CPU Credits Consumed
 *      - Disk Read
 *      - Disk Write
 *      - Disk Read Ops
 *      - Disk Write Ops
 *      - Data Disk Read
 *      - Data Disk Write
 *      - Data Disk Latency
 *      - OS Disk Read
 *      - OS Disk Write
 *      - OS Disk Latency
 *      - OS Disk Read Ops
 *      - OS Disk Write Ops
 *      - Vm Availability
 *      - Temp Disk Latency
 *      - Temp Disk Read
 *      - Temp Disk Write
 *
 **/

// Parameters for Azure authentication
const tenantId = D.getParameter('tenantID')
const clientId = D.getParameter('clientId')
const clientSecret = D.getParameter('clientSecret')
const subscriptionId = D.getParameter('subscriptionId')

const resourceGroups = D.getParameter('resourceGroups')
const vmNames = D.getParameter('vmNames')

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com')
const azureCloudManagementService = D.createExternalDevice('management.azure.com')

let accessToken
let vmTable
let allMetricByVm = []

// This is the list of all allowed performance metrics that can be retrieved from a running VM.
// To include a specific metric for retrieval, move it to the performanceMetrics list, and it will appear dynamically in the output table.
// const allowedPerformanceMetrics = [
//     {label: 'OS Disk Max Burst BW', valueType: D.valueType.NUMBER, key: 'OS Disk Max Burst Bandwidth'},
//     {label: 'OS Disk Target BW', valueType: D.valueType.NUMBER, key: 'OS Disk Target Bandwidth'},
//     {label: 'OS Disk Max Burst IOPS', valueType: D.valueType.NUMBER, key: 'OS Disk Max Burst IOPS'},
//     {label: 'Network In', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network In', callback: convertBytesToGb},
//     {label: 'OS Disk Target IOPS', valueType: D.valueType.NUMBER, key: 'OS Disk Target IOPS'},
//     {label: 'Premium Disk Cache Hit', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium OS Disk Cache Read Hit'},
//     {label: 'Network Out', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network Out', callback: convertBytesToGb},
//     {label: 'Inbound Flows', valueType: D.valueType.NUMBER, key: 'Inbound Flows'},
//     {label: 'Outbound Flows', valueType: D.valueType.NUMBER, key: 'Outbound Flows'},
//     {label: 'Inbound Flow Rate', valueType: D.valueType.NUMBER, key: 'Inbound Flows Maximum Creation Rate'},
//     {label: 'Outbound Flow Rate', valueType: D.valueType.NUMBER, key: 'Outbound Flows Maximum Creation Rate'},
//     {label: 'Premium Disk Miss', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium OS Disk Cache Read Miss'},
//     {label: 'Disk Queue Depth', valueType: D.valueType.NUMBER, key: 'OS Disk Queue Depth'},
//     {label: 'BW Consumed %', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk Bandwidth Consumed Percentage'},
//     {label: 'IOPS Consumed %', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk IOPS Consumed Percentage'},
//     {label: 'Burst BPS Credits %',valueType: D.valueType.NUMBER,unit: '%',key: 'OS Disk Used Burst BPS Credits Percentage'},
//     {label: 'Burst IO Credits %',valueType: D.valueType.NUMBER,unit: '%',key: 'OS Disk Used Burst IO Credits Percentage'},
//     {label: 'Temp Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Temp Disk Read Operations/Sec'},
//     {label: 'Temp Disk Write Ops',valueType: D.valueType.NUMBER,unit: 'ops/sec',key: 'Temp Disk Write Operations/Sec'},
//     {label: 'Temp Disk Queue', valueType: D.valueType.NUMBER, key: 'Temp Disk Queue Depth'},
//     {label: 'Cached BW Consumed',valueType: D.valueType.NUMBER,unit: '%',key: 'VM Cached Bandwidth Consumed Percentage'},
//     {label: 'Cached IOPS %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Cached IOPS Consumed Percentage'},
//     {label: 'Uncached BW %',valueType: D.valueType.NUMBER,unit: '%',key: 'VM Uncached Bandwidth Consumed Percentage'},
//     {label: 'Uncached IOPS %', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Uncached IOPS Consumed Percentage'},
//     {label: 'Remote Burst IO %',valueType: D.valueType.NUMBER,unit: '%',key: 'VM Remote Used Burst IO Credits Percentage'},
//     {label: 'Remote Burst BPS %',valueType: D.valueType.NUMBER,unit: '%',key: 'VM Remote Used Burst BPS Credits Percentage'},
//     {label: 'Data Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Data Disk Read Operations/Sec'},
//     {label: 'Data Disk Write Ops',valueType: D.valueType.NUMBER,unit: 'ops/sec',key: 'Data Disk Write Operations/Sec'},
//     {label: 'Data Disk Queue', valueType: D.valueType.NUMBER, key: 'Data Disk Queue Depth'},
//     {label: 'Data BW Consumed',valueType: D.valueType.NUMBER,unit: '%',key: 'Data Disk Bandwidth Consumed Percentage'},
//     {label: 'Data IOPS Consumed', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk IOPS Consumed Percentage'},
//     {label: 'Data Disk Target BW', valueType: D.valueType.NUMBER, key: 'Data Disk Target Bandwidth'},
//     {label: 'Data Disk Target IOPS', valueType: D.valueType.NUMBER, key: 'Data Disk Target IOPS'},
//     {label: 'Data Max Burst BW', valueType: D.valueType.NUMBER, key: 'Data Disk Max Burst Bandwidth'},
//     {label: 'Data Max Burst IOPS', valueType: D.valueType.NUMBER, key: 'Data Disk Max Burst IOPS'},
//     {label: 'Burst BPS Credits %',valueType: D.valueType.NUMBER,unit: '%',key: 'Data Disk Used Burst BPS Credits Percentage'},
//     {label: 'Burst IO Credits %',valueType: D.valueType.NUMBER,unit: '%',key: 'Data Disk Used Burst IO Credits Percentage'},
//     {label: 'Cache Read Hit', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium Data Disk Cache Read Hit'},
//     {label: 'Cache Read Miss', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium Data Disk Cache Read Miss'},
//     {label: 'Local Burst IO %',valueType: D.valueType.NUMBER,unit: '%',key: 'VM Local Used Burst IO Credits Percentage'},
//     {label: 'Local Burst BPS %',valueType: D.valueType.NUMBER,unit: '%',key: 'VM Local Used Burst BPS Credits Percentage'}
// ]

// This is the list of selected performance metrics retrieved when a VM is running
// To exclude a specific metric from this list, move it to the allowedPerformanceMetrics list, and it will no longer appear dynamically in the output table
const performanceMetrics = [
    {label: 'Network Out Total', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network Out Total', callback: convertBytesToGb},
    {label: 'Network In Total', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network In Total', callback: convertBytesToGb},
    {label: 'Available Memory', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Available Memory Bytes', callback: convertBytesToGb},
    {label: 'Percentage CPU', valueType: D.valueType.NUMBER, unit: '%', key: 'Percentage CPU'},
    {label: 'CPU Credits Remaining', valueType: D.valueType.NUMBER, key: 'CPU Credits Remaining'},
    {label: 'CPU Credits Consumed', valueType: D.valueType.NUMBER, key: 'CPU Credits Consumed'},
    {label: 'Disk Read', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Disk Read Bytes', callback: convertBytesToGb},
    {label: 'Disk Write', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Disk Write Bytes', callback: convertBytesToGb},
    {label: 'Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Disk Read Operations/Sec'},
    {label: 'Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Disk Write Operations/Sec', callback: formatNumberToTwoDecimals},
    {label: 'Data Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Data Disk Read Bytes/sec'},
    {label: 'Data Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Data Disk Write Bytes/sec'},
    {label: 'Data Disk Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'Data Disk Latency', callback: formatNumberToTwoDecimals},
    {label: 'OS Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'OS Disk Read Bytes/sec'},
    {label: 'OS Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'OS Disk Write Bytes/sec'},
    {label: 'OS Disk Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'OS Disk Latency'},
    {label: 'OS Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'OS Disk Read Operations/Sec'},
    {label: 'OS Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'OS Disk Write Operations/Sec'},
    {label: 'Vm Availability', valueType: D.valueType.NUMBER, key: 'VmAvailabilityMetric', callback: function (value){if(value === 1) return "Yes"; return "No"}},
    {label: 'Temp Disk Latency', valueType: D.valueType.NUMBER, unit: 'ms', key: 'Temp Disk Latency'},
    {label: 'Temp Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Temp Disk Read Bytes/sec'},
    {label: 'Temp Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Temp Disk Write Bytes/sec'}
]

// Extract configuration information for the VM
const vmConfigExtractors = [
    {
        label: 'OS Name', valueType: D.valueType.STRING, key: 'osName', extract: function (bodyAsJSON) {
            return bodyAsJSON && bodyAsJSON.osName ? bodyAsJSON.osName : "N/A"
        }
    }, {
        label: 'OS Version', valueType: D.valueType.STRING, key: 'osVersion', extract: function (bodyAsJSON) {
            return bodyAsJSON && bodyAsJSON.osVersion ? bodyAsJSON.osVersion : "N/A"
        }
    }, {
        label: 'Extension Type', valueType: D.valueType.STRING, key: 'type', extract: function (bodyAsJSON) {
            return bodyAsJSON && bodyAsJSON.vmAgent && bodyAsJSON.vmAgent.extensionHandlers && bodyAsJSON.vmAgent.extensionHandlers.length ? bodyAsJSON.vmAgent.extensionHandlers[0].type : "N/A"
        }
    }, {
        label: 'Extension Status', valueType: D.valueType.STRING, key: 'statusCode', extract: function (bodyAsJSON) {
            return bodyAsJSON && bodyAsJSON.vmAgent && bodyAsJSON.vmAgent.extensionHandlers && bodyAsJSON.vmAgent.extensionHandlers.length && bodyAsJSON.vmAgent.extensionHandlers[0].status && bodyAsJSON.vmAgent.extensionHandlers[0].status.code ? bodyAsJSON.vmAgent.extensionHandlers[0].status.code : "N/A"
        }
    }, {
        label: 'Extension Status msg', valueType: D.valueType.STRING, key: 'statusMessage', extract: function (bodyAsJSON) {
            return bodyAsJSON && bodyAsJSON.vmAgent && bodyAsJSON.vmAgent.extensionHandlers && bodyAsJSON.vmAgent.extensionHandlers.length && bodyAsJSON.vmAgent.extensionHandlers[0].status && bodyAsJSON.vmAgent.extensionHandlers[0].status.message ? bodyAsJSON.vmAgent.extensionHandlers[0].status.message : "N/A"
        }
    }, {
        label: 'Power State', valueType: D.valueType.STRING, key: 'displayStatus', extract: function (bodyAsJSON) {
            return bodyAsJSON && bodyAsJSON.statuses[1] && bodyAsJSON.statuses[1].displayStatus ? bodyAsJSON.statuses[1].displayStatus : "N/A"
        }
    }
]

// Extract basic VM information
const vmInfoExtractors = [
    {key: "id", extract: function (vm) {return sanitize(vm.properties.vmId)}},
    {label: 'Name', valueType: D.valueType.NUMBER, key: 'vmName', extract: function (vm) {return vm.name || "N/A"}}, 
    {label: 'Resource Group', valueType: D.valueType.STRING, key: 'resourceGroup', extract: extractResourceGroup}, 
    {label: 'OS Type', valueType: D.valueType.STRING, key: 'osType', extract: function (vm) {return vm.location || "N/A"}}
]

/**
 * Extracts the resource group from the VM object
 * @param {Object} vm The VM object containing the resource group information in its ID
 * @returns {string} The name of the resource group, or "N/A" if not found
 */
function extractResourceGroup(vm) {
    let resourceGroup = "N/A"
    if (vm.id) {
        const resourceGroupMatch = vm.id.match(/\/resourceGroups\/([^\/]*)\//)
        if (resourceGroupMatch && resourceGroupMatch[1]) resourceGroup = resourceGroupMatch[1]
    }
    return resourceGroup
}

/**
 * Formats a given value to two decimal places if it is a valid number
 * @param value The value to be formatted
 * @returns The formatted value as a string with two decimal places, or the original value if it is not a valid number
 */
function formatNumberToTwoDecimals(value) {
    let number = parseFloat(value)
    if (isNaN(number)) {
        return value
    }
    return number.toFixed(2)
}

/**
 * Converts a value from bytes to gigabytes
 * @param bytesValue The value in bytes
 * @returns {string} The value converted to gigabytes, rounded to two decimal places
 */
function convertBytesToGb(bytesValue) {
    if (bytesValue !== "N/A") {
        return (bytesValue / (1024 * 1024 * 1024)).toFixed(2)
    }
    return bytesValue
}

/**
 * Sanitizes the output by removing reserved words and formatting it
 * @param {string} output The string to be sanitized
 * @returns {string} The sanitized string
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
 * Processes the login response from the Azure API and extracts the access token
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
 * Filters a list of virtual machine info based on the selected resource groups and VM names
 * @param {Array} vmInfoList List of virtual machine information objects to filter
 * @returns {Array} Filtered list of virtual machine information objects
 */
function filterVmInfoList(vmInfoList) {
    return vmInfoList.filter(function (vmInfo) {
        return ((resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') || resourceGroups.some(function (resourceGroup) {
            return resourceGroup.toLowerCase() === vmInfo.resourceGroup.toLowerCase()
        })) && ((vmNames.length === 1 && vmNames[0].toLowerCase() === 'all') || vmNames.some(function (vmName) {
            return vmName.toLowerCase() === vmInfo.vmName.toLowerCase()
        }))
    })
}

/**
 * Processes the response from the VMs API call, extracts VM data, and populates the table
 * @param {Object} d The deferred promise object
 * @returns {Function} A function to process the HTTP response
 */
function processVMsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response)
        const bodyAsJSON = JSON.parse(body)
        if (!bodyAsJSON.value) {
            D.failure(D.errorType.GENERIC_ERROR)
            d.reject("No VMs found in the response")
            return
        }
        let vmInfoList = bodyAsJSON.value.map(extractVmInfo)
        if (!vmInfoList.length) {
            console.info('There is no Virtual machine')
        } else {
            vmInfoList = filterVmInfoList(vmInfoList)
        }
        d.resolve(vmInfoList)
    }
}

/**
 * Processes the VM configuration API response and updates the VM display status
 * @param {Object} d The deferred promise object
 * @param {Object} vmInfo The VM information object to be updated with display status
 * @returns {Function} A function to process the HTTP response and update the VM display status
 */
function processVmConfigResponse(d, vmInfo, error, response, body) {
    checkHTTPError(error, response)
    if (error || response.statusCode !== 200) {
        return
    }
    try {
        const bodyAsJSON = JSON.parse(body)
        extractVmConfig(vmInfo, bodyAsJSON)
        d.resolve(vmInfo)
    } catch (parseError) {
        console.error("Error parsing VM configuration:", parseError)
        d.reject(parseError)
    }
}

/**
 * Inserts or updates metrics for a virtual machine in the `allMetricByVm` object.
 * @param {string} vmName - The name of the virtual machine.
 * @param {Object} vmMetrics - The metrics to insert or merge with existing metrics.
 */
function insertAllMetrics(vmName, vmMetrics) {
    if (allMetricByVm[vmName]) {
        allMetricByVm[vmName] = Object.assign(allMetricByVm[vmName], vmMetrics)
    } else {
        allMetricByVm[vmName] = vmMetrics
    }
}

/**
 * Extracts metrics from the response body and processes them into a performance object.
 * @param {string} body - The HTTP response body in JSON string format.
 * @returns {Object} An object containing the extracted performance metrics.
 * @throws Will invoke `D.failure` with a generic error if the `value` property is missing in the parsed body.
 */
function extractMetricsFromBody(body) {
    const bodyAsJSON = JSON.parse(body)
    if (!bodyAsJSON.value) {
        D.failure(D.errorType.GENERIC_ERROR)
    }
    return bodyAsJSON.value.reduce(function(acc, performanceInfo) {
        const vmPerformance = extractVmPerformance(performanceInfo);
        if (vmPerformance) {
            Object.assign(acc, vmPerformance);
        }
        return acc;
    }, {});
}

/**
 * Processes the response from the VMs API call and populates the table with VM data
 * @param {Object} d The deferred promise object
 * @param vmInfo
 * @param error
 * @param response
 * @param body
 * @returns {Function} A function to process the HTTP response
 */
function processVmPerformanceResponse(d, vmInfo, error, response, body) {
    checkHTTPError(error, response)
    if (error || response.statusCode !== 200) {
        return
    }
    try {
        const vmMetrics = extractMetricsFromBody(body);
        insertAllMetrics(vmInfo.vmName, vmMetrics);
        d.resolve(allMetricByVm)
    } catch (parseError) {
        console.error("Error parsing VM Performance:", parseError)
        d.reject("Failed to parse response: " + parseError)
    }
}

/**
 * Logs in to the Azure cloud service using OAuth2 credentials
 * @returns {Promise} A promise that resolves upon successful login
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
 * Extracts relevant VM information from a VM object returned by the Azure API
 * @param {Object} vm The VM object containing various properties
 * @returns {Object|null} An object containing the extracted VM information, or null if the VM object is invalid
 */
function extractVmInfo(vm) {
    if (!vm || !vm.properties || !vm.properties.vmId) return null
        const extractedInfo = {}
        vmInfoExtractors.forEach(function (row) {
            extractedInfo[row.key] = row.extract(vm)
    })
    return extractedInfo
}

/**
 * Extracts configuration details for a virtual machine from a JSON response.
 * @param {Object} vmInfo - An object to store the extracted virtual machine configuration.
 * @param {Object} bodyAsJSON - The JSON response containing VM configuration data.
 * @returns {Array<*>} An array of extracted values from `vmConfigExtractors`.
 */

function extractVmConfig(vmInfo, bodyAsJSON) {
    return vmConfigExtractors.map(function (item) {
        vmInfo[item.key] = item.extract(bodyAsJSON)
    })
}

/**
 * Retrieves the first key from the given data array that is not a "timeStamp" key
 * @param {Array} data The array of data entries where each entry contains key-value pairs
 * @returns {String|null} The first key that is not "timeStamp", or null if none are found
 */
function getNonTimeStampKey(data) {
    if (!data || data.length === 0) {
        return null
    }
    const entry = data[0]
    for (const key in entry) {
        if (key !== "timeStamp") {
            return key
        }
    }
    return null
}

/**
 * Extracts performance metrics for a VM and populates the VM info object
 * @param {Object} performanceInfo The performance metrics information for the VM
 * @param {Object} vmInfo The VM information object to populate with performance metrics
 */
function extractVmPerformance(performanceInfo) {
    if (performanceInfo.name.value) {
        if (performanceInfo.timeseries && performanceInfo.timeseries[0] && performanceInfo.timeseries[0].data) {
            const key = getNonTimeStampKey(performanceInfo.timeseries[0].data)
            return {
                [performanceInfo.name.value]: key
                    ? performanceInfo.timeseries[0].data[0][key]
                    : "N/A"
            };
        } else {
            return {[performanceInfo.name.value]: "N/A"}
        }
    }
    return null
}

/**
 * Generates a configuration object for making an HTTP request.
 * @param {string} url - The endpoint URL to append to the subscription path.
 * @returns {Object} The HTTP request configuration containing the full URL, protocol, headers with authorization, and additional options.
 */
function generateConfig(url) {
    return {
        url: "/subscriptions/" + subscriptionId + url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken,
        }, rejectUnauthorized: false, jar: true
    }
}

/**
 * Retrieves a list of Azure VMs for the configured or all resource groups
 * @returns {Promise} A promise that resolves with the VM data upon successful retrieval from the Azure API
 */
function retrieveVMs() {
    const d = D.q.defer()
    const config = generateConfig("/providers/Microsoft.Compute/virtualMachines?api-version=2021-04-01")
    azureCloudManagementService.http.get(config, processVMsResponse(d))
    return d.promise
}

/**
 * Performs an HTTP GET request and processes the response with a callback.
 * @param {Object} config - The HTTP request configuration.
 * @param {Object} vmInfo - Virtual machine details for processing.
 * @param {Function} callback - Handles the response with the signature: (deferred, vmInfo, error, response, body).
 * @returns {Promise} Resolves or rejects based on the callback's logic.
 */
function callGetHttpRequest(config, vmInfo, callback) {
    var d = D.q.defer();
    azureCloudManagementService.http.get(config, function (error, response, body) {
        callback(d, vmInfo, error, response, body)
    })
    return d.promise;
}

/**
 * Retrieves the configuration of Azure VMs for the configured or all resource groups
 * @param {Array} vmInfoList A list of VM information objects, each containing details like resource group and VM name
 * @returns {Promise} A promise that resolves when the configuration for all VMs has been retrieved
 */
function retrieveVMsConfiguration(vmInfoList) {
    const promises = vmInfoList.map(function (vmInfo) {
        const config = generateConfig("/resourceGroups/" + vmInfo.resourceGroup + "/providers/Microsoft.Compute/virtualMachines/" + vmInfo.vmName + "/instanceView?api-version=2024-07-01")
        return callGetHttpRequest(config, vmInfo, processVmConfigResponse)
    })
    return D.q.all(promises)
}

/**
 * Groups performance metric keys into batches of a defined maximum size.
 * @returns {Array<string>} An array of grouped metric keys, each group containing a
 *    maximum of `maxGroupSize` keys, joined by commas.
 */
function groupingRequestParams() {
    const performanceKeyGroups = []
    const maxGroupSize = 20
    for (let i = 0; i < performanceMetrics.length; i += maxGroupSize) {
        performanceKeyGroups.push(performanceMetrics.slice(i, i + maxGroupSize).map(function (metric) {
            return metric.key
        }).join(','))
    }
    return performanceKeyGroups;
}

/**
 * Retrieves performance metrics for Azure VMs, grouped by performance metrics
 * @param {Array} vmInfoList List of VM information objects to retrieve performance metrics for
 * @returns {Promise} A promise that resolves once all performance data has been retrieved
 */
function retrieveVMsPerformanceMetrics(vmInfoList) {
    const promises = []
    const performanceKeyGroups = groupingRequestParams();
    vmInfoList.forEach(function (vmInfo) {
        if (vmInfo.displayStatus === "VM running") {
            performanceKeyGroups.forEach(function (group) {
                const config = generateConfig("/resourceGroups/" + vmInfo.resourceGroup + "/providers/Microsoft.Compute/virtualMachines/" + vmInfo.vmName + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group + "&timespan=PT1M")
                promises.push(callGetHttpRequest(config, vmInfo, processVmPerformanceResponse))
            })
        }
    })
    return D.q.all(promises)
}

/**
 * Generates the combined list of VM properties, including extractors for basic information, configuration, and performance metrics
 * @returns {Array} A list of all virtual machine properties, filtered to include only those with labels
 */
function generateVirtualMachineProperties() {
    return vmInfoExtractors.concat(vmConfigExtractors).concat(performanceMetrics).filter(function (result) {
        return result.label
    })
}

/**
 * Creates the virtual machine table structure for displaying the VM metrics
 * @param {Array} vmProperties The list of properties to be included in the VM table
 */
function createVirtualMachineTable(vmProperties) {
    vmTable = D.createTable('Virtual Machines Metrics', vmProperties.map(function (item) {
        const tableDef = {label: item.label, valueType: item.valueType}
        if (item.unit) {
            tableDef.unit = item.unit
        }
        return tableDef
    }))
}

/**
 * Inserts a record of a virtual machine's data into the VM table
 * @param {Object} vm The virtual machine data to insert
 * @param {Array} vmProperties The list of properties that define the VM's metrics
 */
function insertRecord(vm, vmProperties) {
    const recordValues = vmProperties.map(function (item) {
        const value = vm[item.key] || "N/A"
        return item.callback ? item.callback(value) : value
    })
    vmTable.insertRecord(vm.id, recordValues)
}

/**
 * Populates the table with the list of virtual machine data and properties
 * @param {Array} vmInfoList List of virtual machine information objects to populate the table
 * @param {Array} vmProperties The properties that define the metrics for each VM
 */
function populateTable(vmInfoList, vmProperties) {
    vmInfoList.map(function (vmInfo) {
        insertRecord(Object.assign(vmInfo, allMetricByVm[vmInfo.vmName]), vmProperties)
    })
}

/**
 * Displays the output by generating a table of virtual machines and their properties.
 * @param {Array<Object>} virtualMachineList - A list of virtual machine objects to display.
 */
function displayOutput(virtualMachineList) {
    const vmProperties = generateVirtualMachineProperties()
    createVirtualMachineTable(vmProperties)
    populateTable(virtualMachineList, vmProperties)
    D.success(vmTable)
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
            D.success()
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Azure VMs List Metrics
 * @documentation This procedure is used to extract the list of Azure virtual machines (VMs), their configuration data, and performance metrics.
 */
function get_status() {
    login()
        .then(retrieveVMs)
        .then(retrieveVMsConfiguration)
        .then(function (virtualMachineList) {
            retrieveVMsPerformanceMetrics(virtualMachineList).then(function () {
                displayOutput(virtualMachineList);
            })
        })
        .catch(function (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}