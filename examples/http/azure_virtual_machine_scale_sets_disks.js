/**
 * Domotz Custom Driver
 * Name: Azure Virtual Machine Scale Sets Metrics
 * Description: Monitor Azure Compute Virtual Machine Scale Sets Metrics: this script retrieves information about Virtual Machine Scale Sets Metrics.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Name
 *      - Resource Group
 *      - Disk Controller Type
 *      - OS Disk Size
 *      - Disk Write Ops
 *      - Disk Read
 *      - Disk Write
 *      - Disk Read Ops
 *      - Data Disk Read
 *      - Data Disk Write
 *      - Data Disk Read Ops
 *      - Data Disk Write Ops
 *      - Data BW
 *      - Data IOPS
 *      - Data Disk Target BW
 *      - DataDisk Target IOPS
 *      - OS Disk BW
 *      - OS Disk IOPS
 *      - OS Disk Read Ops
 *      - OS Disk Write Ops
 *      - OS Disk Read
 *      - OS Disk Write
 *
 **/
// Parameters for Azure authentication
const tenantId = D.getParameter('tenantId');
const clientId = D.getParameter('clientId');
const clientSecret = D.getParameter('clientSecret');
const subscriptionId = D.getParameter('subscriptionId');

const resourceGroups = D.getParameter('resourceGroups');
const vmNames = D.getParameter('vmNames');

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com');
const azureCloudManagementService = D.createExternalDevice('management.azure.com');

let accessToken;
let virtualMachineScaleSetTable;

// This is the list of all allowed performance metrics that can be retrieved.
// To include a specific metric for retrieval, move it to the performanceMetrics list, and it will appear dynamically in the output table.
// const allowedPerformanceMetrics = [
//     {label: 'Cached BW', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Cached Bandwidth Consumed Percentage'},
//     {label: 'Cached IOPS', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Cached IOPS Consumed Percentage'},
//     {label: 'Uncached BW', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Uncached Bandwidth Consumed Percentage'},
//     {label: 'Uncached IOPS', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Uncached IOPS Consumed Percentage'},
//     {label: 'Local Burst BPS', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Local Used Burst BPS Credits Percentage'},
//     {label: 'Premium Disk Miss', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium Data Disk Cache Read Miss'},
//     {label: 'OS Disk Cache Hit', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium OS Disk Cache Read Hit'},
//     {label: 'OS Disk Cache Miss', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium OS Disk Cache Read Miss'},
//     {label: 'Data Disk Queue', valueType: D.valueType.NUMBER, key: 'Data Disk Queue Depth'},
//     {label: 'Data Max Burst BW', valueType: D.valueType.NUMBER, key: 'Data Disk Max Burst Bandwidth'},
//     {label: 'Data Max Burst IOPS', valueType: D.valueType.NUMBER, key: 'Data Disk Max Burst IOPS'},
//     {label: 'OS Disk Queue', valueType: D.valueType.NUMBER, key: 'OS Disk Queue Depth'},
//     {label: 'Data BW Burst', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk Used Burst BPS Credits Percentage'},
//     {label: 'Data IO Burst', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk Used Burst IO Credits Percentage'},
//     {label: 'OS Max Burst BW', valueType: D.valueType.NUMBER, key: 'OS Disk Max Burst Bandwidth'},
//     {label: 'OS Max Burst IOPS', valueType: D.valueType.NUMBER, key: 'OS Disk Max Burst IOPS'},
//     {label: 'OS Disk Target BW', valueType: D.valueType.NUMBER, key: 'OS Disk Target Bandwidth'},
//     {label: 'OS Disk Target IOPS', valueType: D.valueType.NUMBER, key: 'OS Disk Target IOPS'},
//     {label: 'OS BW Burst', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk Used Burst BPS Credits Percentage'},
//     {label: 'OS IO Burst', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk Used Burst IO Credits Percentage'},
//     {label: 'Premium Disk Hit', valueType: D.valueType.NUMBER, unit: '%', key: 'Premium Data Disk Cache Read Hit'}
// ];

// This is the list of selected performance metrics retrieved.
// To exclude a specific metric from this list, move it to the allowedPerformanceMetrics list, and it will no longer appear dynamically in the output table.
const performanceMetrics = [{
    label: 'Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Disk Write Operations/Sec'
}, {
    label: 'Disk Read', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Disk Read Bytes', callback: convertBytesToGb
}, {
    label: 'Disk Write', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Disk Write Bytes', callback: convertBytesToGb
}, {
    label: 'Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Disk Read Operations/Sec'
}, {
    label: 'Data Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Data Disk Read Bytes/sec'
}, {
    label: 'Data Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'Data Disk Write Bytes/sec'
}, {
    label: 'Data Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Data Disk Read Operations/Sec'
}, {
    label: 'Data Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Data Disk Write Operations/Sec'
}, {
    label: 'Data BW', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk Bandwidth Consumed Percentage'
}, {
    label: 'Data IOPS', valueType: D.valueType.NUMBER, unit: '%', key: 'Data Disk IOPS Consumed Percentage'
}, {
    label: 'Data Disk Target BW', valueType: D.valueType.NUMBER, key: 'Data Disk Target Bandwidth'
}, {label: 'DataDisk Target IOPS', valueType: D.valueType.NUMBER, key: 'Data Disk Target IOPS'}, {
    label: 'OS Disk BW', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk Bandwidth Consumed Percentage'
}, {
    label: 'OS Disk IOPS', valueType: D.valueType.NUMBER, unit: '%', key: 'OS Disk IOPS Consumed Percentage'
}, {
    label: 'OS Disk Read Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'OS Disk Read Operations/Sec'
}, {
    label: 'OS Disk Write Ops', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'OS Disk Write Operations/Sec'
}, {
    label: 'OS Disk Read', valueType: D.valueType.NUMBER, unit: 'bps', key: 'OS Disk Read Bytes/sec'
}, {label: 'OS Disk Write', valueType: D.valueType.NUMBER, unit: 'bps', key: 'OS Disk Write Bytes/sec'}]

const virtualMachineScaleSetInfoExtractors = [{
    key: "id", valueType: D.valueType.STRING, extract: function (value) {
        return sanitize(value.properties.uniqueId)
    }
}, {
    key: "name", label: 'Name', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.name || "N/A"
    }
}, {key: "resourceGroup", label: 'Resource Group', valueType: D.valueType.STRING, extract: extractResourceGroup}, {
    key: "diskControllerType", label: 'Disk Controller Type', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.diskControllerType || "N/A"
    }
}, {
    key: "osDiskSizeGB", label: 'OS Disk Size', valueType: D.valueType.NUMBER, unit: 'Gb', extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.osDisk && value.properties.virtualMachineProfile.storageProfile.osDisk.diskSizeGB || "N/A"
    }
}];

/**
 * Generates Virtual Machine Scale Sets properties by extracting information from the defined virtualMachineScaleSetInfoExtractors.
 * @returns {Array} return concatenation of `virtualMachineScaleSetInfoExtractors` and `performanceMetrics`.
 */
function generateVirtualMachineScaleSetProperties() {
    return virtualMachineScaleSetInfoExtractors.concat(performanceMetrics).filter(function (result) {
        return result.label
    });
}


/**
 * Creates a table for displaying Azure Virtual Machine Scale Sets properties.
 * using the `D.createTable` method with the properties defined in `virtualMachineScaleSetProperties`.
 */
function createVirtualMachineScaleSetTable(virtualMachineScaleSetProperties) {
    virtualMachineScaleSetTable = D.createTable('Azure Virtual Machine Scale Sets', virtualMachineScaleSetProperties);
}

/**
 * Extracts the resource group from the Virtual Machine Scale Set object.
 * @param {Object} virtualMachineScaleSet - The Virtual Machine Scale Set object containing the resource group information in its ID.
 * @returns {string} The name of the resource group, or "N/A" if not found.
 */
function extractResourceGroup(virtualMachineScaleSet) {
    let resourceGroup = "N/A";
    if (virtualMachineScaleSet.id) {
        const resourceGroupMatch = virtualMachineScaleSet.id.match(/\/resourceGroups\/([^\/]*)\//);
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
 * Filters the list of Virtual Machine Scale Set information by specified resource groups.
 * @param {Array} virtualMachineScaleSetInfoList - A list of Virtual Machine Scale Set information objects.
 * @returns {Array} The filtered list of Virtual Machine Scale Set information based on resource groups.
 */
function filterVirtualMachineScaleSetInfoList(virtualMachineScaleSetInfoList) {
    return virtualMachineScaleSetInfoList.filter(function (virtualMachineScaleSet) {
        return ((resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') || resourceGroups.some(function (resourceGroup) {
            return resourceGroup.toLowerCase() === virtualMachineScaleSet.resourceGroup.toLowerCase()
        })) && ((vmNames.length === 1 && vmNames[0].toLowerCase() === 'all') || vmNames.some(function (vmName) {
            return vmName.toLowerCase() === virtualMachineScaleSet.name.toLowerCase();
        }))
    });
}


/**
 * Processes the response from the Virtual Machine Scale Sets API call and extracts Virtual Machine Scale Set information.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processVirtualMachineScaleSetsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            D.failure(D.errorType.GENERIC_ERROR)
            d.reject("No Virtual Machine Scale Sets found in the response");
            return;
        }
        let virtualMachineScaleSetInfoList = bodyAsJSON.value.map(extractVirtualMachineScaleSetInfo);
        if (!virtualMachineScaleSetInfoList.length) {
            console.info('There is no Virtual machine');
        } else {
            virtualMachineScaleSetInfoList = filterVirtualMachineScaleSetInfoList(virtualMachineScaleSetInfoList);
        }
        d.resolve(virtualMachineScaleSetInfoList);
    }
}

/**
 * Logs in to the Azure cloud service using OAuth2 credentials.
 * @returns {Promise} A promise that resolves upon successful login.
 */
function login() {
    const d = D.q.defer();
    const config = {
        url: "/" + tenantId + "/oauth2/token", protocol: "https", headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        }, form: {
            grant_type: "client_credentials",
            client_id: clientId,
            client_secret: clientSecret,
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
 * Extracts necessary information from a virtualMachineScaleSet object.
 * @param {Object} virtualMachineScaleSet - The virtualMachineScaleSet object containing constious properties.
 * @returns {Object|null} The extracted virtualMachineScaleSet information or empty object.
 */
function extractVirtualMachineScaleSetInfo(virtualMachineScaleSet) {
    if (!virtualMachineScaleSet || !virtualMachineScaleSet.properties || !virtualMachineScaleSet.properties.uniqueId) return null;
    const extractedInfo = {};
    virtualMachineScaleSetInfoExtractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(virtualMachineScaleSet);
    });
    return extractedInfo;
}

/**
 * Inserts a record into the Virtual Machine Scale Set table.
 * @param {Object} virtualMachineScaleSet - The Virtual Machine Scale Set information to insert into the table.
 * @param virtualMachineScaleSetProperties
 */
function insertRecord(virtualMachineScaleSet, virtualMachineScaleSetProperties) {
    const recordValues = virtualMachineScaleSetProperties.map(function (item) {
        const value = virtualMachineScaleSet[item.key] || 'N/A';
        return item.callback && value !== 'N/A' ? item.callback(value) : value;
    });
    virtualMachineScaleSetTable.insertRecord(virtualMachineScaleSet.id, recordValues);
}

/**
 * Generates the HTTP configuration for an API request.
 * @param {string} url - The URL to connect to.
 * @returns {Object} The HTTP configuration.
 */
function generateConfig(url) {
    return {
        url: "/subscriptions/" + subscriptionId + url, protocol: "https", headers: {
            "Authorization": "Bearer " + accessToken,
        }, rejectUnauthorized: false, jar: true
    };
}

/**
 * Retrieves Azure Virtual Machine Scale Sets for the subscription.
 * @returns {Promise} A promise that resolves with the Virtual Machine Scale Set data.
 */
function retrieveVirtualMachineScaleSets() {
    const d = D.q.defer();
    const config = generateConfig("/providers/Microsoft.Compute/virtualMachineScaleSets?api-version=2024-07-01");
    azureCloudManagementService.http.get(config, processVirtualMachineScaleSetsResponse(d));
    return d.promise;
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
 * Extracts Virtual Machine Scale Set performance data and updates the Virtual Machine Scale Set information.
 * @param {Object} performanceInfo - The performance information object.
 * @param {Object} virtualMachineScaleSetInfo - The Virtual Machine Scale Set information to update.
 */
function extractVirtualMachineScaleSetPerformance(performanceInfo, virtualMachineScaleSetInfo) {
    if (performanceInfo.name.value) {
        if (performanceInfo.timeseries && performanceInfo.timeseries[0] && performanceInfo.timeseries[0].data) {
            const key = getNonTimeSeriesKey(performanceInfo.timeseries[0].data);
            virtualMachineScaleSetInfo[performanceInfo.name.value] = key ? performanceInfo.timeseries[0].data[0][key] : "N/A";
        } else {
            virtualMachineScaleSetInfo[performanceInfo.name.value] = "N/A"
        }
    }
}

/**
 * Processes the Virtual Machine Scale Set performance API response and updates the Virtual Machine Scale Set information.
 * @param {Object} d - The deferred promise object.
 * @param {Object} virtualMachineScaleSetInfo - The Virtual Machine Scale Set information to update.
 * @returns {Function} A function to process the HTTP response.
 */
function processVirtualMachineScaleSetPerformanceResponse(d, virtualMachineScaleSetInfo) {
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
                extractVirtualMachineScaleSetPerformance(performanceInfo, virtualMachineScaleSetInfo)
            });
            d.resolve(virtualMachineScaleSetInfo);
        } catch (parseError) {
            console.error("Error parsing Virtual Machine Scale Sets configuration:", parseError);
            d.reject("Failed to parse response for " + virtualMachineScaleSetInfo.name);
        }
    }
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
 * Retrieves performance metrics for each Virtual Machine Scale Set in the provided Virtual Machine Scale Set information list.
 * @param {Array} virtualMachineScaleSetInfoList - A list of Virtual Machine Scale Set information objects.
 * @returns {Promise} A promise that resolves when all performance metrics have been retrieved.
 */
function retrieveVirtualMachineScaleSetsPerformanceMetrics(virtualMachineScaleSetInfoList) {
    const performanceKeyGroups = [];
    const promises = []
    const maxGroupSize = 20;
    for (let i = 0; i < performanceMetrics.length; i += maxGroupSize) {
        performanceKeyGroups.push(performanceMetrics.slice(i, i + maxGroupSize).map(function (metric) {
            return metric.key
        }).join(','));
    }
    virtualMachineScaleSetInfoList.forEach(function (diskInfo) {
        performanceKeyGroups.forEach(function (group) {
            const d = D.q.defer();
            const config = generateConfig("/resourceGroups/" + diskInfo.resourceGroup + "/providers/Microsoft.Compute/virtualMachineScaleSets/" + diskInfo.name + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group + "&timespan=PT1M");
            azureCloudManagementService.http.get(config, processVirtualMachineScaleSetPerformanceResponse(d, diskInfo));
            promises.push(d.promise);
        });
    });
    return D.q.all(promises);
}

/**
 * Populates all Virtual Machine Scale Sets into the output table by calling insertRecord for each Virtual Machine Scale Set in the list.
 * @param {Array} virtualMachineScaleSetInfoList - A list of Virtual Machine Scale Set information objects to be inserted into the table.
 * @param virtualMachineScaleSetProperties
 */
function populateTable(virtualMachineScaleSetInfoList, virtualMachineScaleSetProperties) {
    virtualMachineScaleSetInfoList.map(function (virtualMachineScaleSetInfo) {
        insertRecord(virtualMachineScaleSetInfo, virtualMachineScaleSetProperties)
    });
}


/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(retrieveVirtualMachineScaleSets)
        .then(retrieveVirtualMachineScaleSetsPerformanceMetrics)
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
 * @label Get Azure Virtual Machine Scale Sets
 * @documentation This procedure is used to extract Azure Virtual Machine Scale Sets.
 */
function get_status() {
    login()
        .then(retrieveVirtualMachineScaleSets)
        .then(retrieveVirtualMachineScaleSetsPerformanceMetrics)
        .then(function (virtualMachineScaleSetInfoList) {
            const virtualMachineScaleSetProperties = generateVirtualMachineScaleSetProperties()
            createVirtualMachineScaleSetTable(virtualMachineScaleSetProperties)
            populateTable(virtualMachineScaleSetInfoList, virtualMachineScaleSetProperties)
            D.success(virtualMachineScaleSetTable);
        })
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
