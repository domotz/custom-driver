/**
 * Domotz Custom Driver
 * Name: Azure Virtual Machine Scale Sets
 * Description: Monitor Azure Compute Virtual Machine Scale Sets: this script retrieves information about Virtual Machine Scale Sets.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Name
 *      - Resource Group
 *      - Location
 *      - SKU Name
 *      - SKU Tier
 *      - SKU Capacity
 *      - Etag
 *      - Orchestration Mode
 *      - Upgrade Policy Mode
 *      - Scale-in Policy Rules
 *      - Scale-in Force Deletion
 *      - Computer Name Prefix
 *      - OS Type
 *      - OS Disk Size
 *      - Disk Controller Type
 *      - Image Publisher
 *      - Image Offer
 *      - Image SKU
 *      - Image Version
 *      - Network Interface Name
 *      - Network IP Configurations
 *      - Provisioning State
 *      - Platform Fault Domain Count
 *      - Time Created
 *      - Available Memory
 *      - Network Out Total
 *      - Network In Total
 *      - CPU Credits Left
 *      - Percentage CPU
 *      - CPU Credits Used
 *      - Vm Availability
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
let virtualMachineScaleSetProperties;
let virtualMachineScaleSetTable;

// This is the list of all allowed performance metrics that can be retrieved.
// To include a specific metric for retrieval, move it to the performanceMetrics list, and it will appear dynamically in the output table.
// const allowedPerformanceMetrics = [
//     {label: 'Network In', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network In', callback: convertBytesToGb },
//     {label: 'Network Out', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'Network Out', callback: convertBytesToGb },
//     {label: 'Remote Burst IO', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Remote Used Burst IO Credits Percentage'},
//     {label: 'Remote Burst BPS', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Remote Used Burst BPS Credits Percentage'},
//     {label: 'Local Burst IO', valueType: D.valueType.NUMBER, unit: '%', key: 'VM Local Used Burst IO Credits Percentage'},
//     {label: 'Inbound Flow Rate', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Inbound Flows Maximum Creation Rate'},
//     {label: 'Outbound Flow Rate', valueType: D.valueType.NUMBER, unit: 'ops/sec', key: 'Outbound Flows Maximum Creation Rate'},
//     {label: 'Outbound Flows', valueType: D.valueType.NUMBER, key: 'Outbound Flows'},
//     {label: 'Inbound Flows', valueType: D.valueType.NUMBER, key: 'Inbound Flows'},
// ];

// This is the list of selected performance metrics retrieved.
// To exclude a specific metric from this list, move it to the allowedPerformanceMetrics list, and it will no longer appear dynamically in the output table.
const performanceMetrics = [{
    label: 'Available Memory',
    valueType: D.valueType.NUMBER,
    unit: 'Gb',
    key: 'Available Memory Bytes',
    callback: convertBytesToGb
}, {
    label: 'Network Out Total',
    valueType: D.valueType.NUMBER,
    unit: 'Gb',
    key: 'Network Out Total',
    callback: convertBytesToGb
}, {
    label: 'Network In Total',
    valueType: D.valueType.NUMBER,
    unit: 'Gb',
    key: 'Network In Total',
    callback: convertBytesToGb
}, {label: 'CPU Credits Left', valueType: D.valueType.NUMBER, key: 'CPU Credits Remaining'}, {
    label: 'Percentage CPU', valueType: D.valueType.NUMBER, unit: '%', key: 'Percentage CPU'
}, {label: 'CPU Credits Used', valueType: D.valueType.NUMBER, key: 'CPU Credits Consumed'}, {
    label: 'Vm Availability', valueType: D.valueType.NUMBER, key: 'VmAvailabilityMetric'
}]

const virtualMachineScaleSetInfoExtractors = [{
    key: "id", label: 'Id', valueType: D.valueType.STRING, extract: function (value) {
        return sanitize(value.properties.uniqueId)
    }
}, {
    key: "name", label: 'Name', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.name || "N/A"
    }
}, {key: "resourceGroup", label: 'Resource Group', valueType: D.valueType.STRING, extract: extractResourceGroup}, {
    key: "location", label: 'Location', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.location || "N/A"
    }
}, {
    key: "skuName", label: 'SKU Name', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.sku && value.sku.name || "N/A"
    }
}, {
    key: "skuTier", label: 'SKU Tier', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.sku && value.sku.tier || "N/A"
    }
}, {
    key: "skuCapacity", label: 'SKU Capacity', valueType: D.valueType.NUMBER, extract: function (value) {
        return value && value.sku && value.sku.capacity || "N/A"
    }
}, {
    key: "etag", label: 'Etag', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.etag || "N/A"
    }
}, {
    key: "orchestrationMode", label: 'Orchestration Mode', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.orchestrationMode || "N/A"
    }
}, {
    key: "upgradePolicyMode", label: 'Upgrade Policy Mode', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.upgradePolicy && value.properties.upgradePolicy.mode || "N/A"
    }
}, {
    key: "scaleInPolicyRules",
    label: 'Scale-in Policy Rules',
    valueType: D.valueType.STRING,
    extract: function (value) {
        return value && value.properties && value.properties.scaleInPolicy && value.properties.scaleInPolicy.rules && value.properties.scaleInPolicy.rules[0] || "N/A"
    }
}, {
    key: "scaleInForceDeletion",
    label: 'Scale-in Force Deletion',
    valueType: D.valueType.BOOLEAN,
    extract: function (value) {
        return value && value.properties && value.properties.scaleInPolicy && value.properties.scaleInPolicy.forceDeletion || "N/A"
    }
}, {
    key: "computerNamePrefix", label: 'Computer Name Prefix', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.osProfile && value.properties.virtualMachineProfile.osProfile.computerNamePrefix || "N/A"
    }
}, {
    key: "osType", label: 'OS Type', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.osDisk && value.properties.virtualMachineProfile.storageProfile.osDisk.osType || "N/A"
    }
}, {
    key: "osDiskSizeGB", label: 'OS Disk Size', valueType: D.valueType.NUMBER, unit: 'Gb', extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.osDisk && value.properties.virtualMachineProfile.storageProfile.osDisk.diskSizeGB || "N/A"
    }
}, {
    key: "diskControllerType", label: 'Disk Controller Type', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.diskControllerType || "N/A"
    }
}, {
    key: "imagePublisher", label: 'Image Publisher', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.imageReference && value.properties.virtualMachineProfile.storageProfile.imageReference.publisher || "N/A"
    }
}, {
    key: "imageOffer", label: 'Image Offer', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.imageReference && value.properties.virtualMachineProfile.storageProfile.imageReference.offer || "N/A"
    }
}, {
    key: "imageSku", label: 'Image SKU', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.imageReference && value.properties.virtualMachineProfile.storageProfile.imageReference.sku || "N/A"
    }
}, {
    key: "imageVersion", label: 'Image Version', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.storageProfile && value.properties.virtualMachineProfile.storageProfile.imageReference && value.properties.virtualMachineProfile.storageProfile.imageReference.version || "N/A"
    }
}, {
    key: "networkInterfaceName",
    label: 'Network Interface Name',
    valueType: D.valueType.STRING,
    extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.networkProfile && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0] && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].name || "N/A"
    }
}, {
    key: "networkIPConfigurations",
    label: 'Network IP Configurations',
    valueType: D.valueType.STRING,
    extract: function (value) {
        return value && value.properties && value.properties.virtualMachineProfile && value.properties.virtualMachineProfile.networkProfile && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0] && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].properties && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].properties.ipConfigurations && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].properties.ipConfigurations[0] && value.properties.virtualMachineProfile.networkProfile.networkInterfaceConfigurations[0].properties.ipConfigurations[0].name || "N/A"
    }
}, {
    key: "provisioningState", label: 'Provisioning State', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.provisioningState || "N/A"
    }
}, {
    key: "platformFaultDomainCount",
    label: 'Platform Fault Domain Count',
    valueType: D.valueType.NUMBER,
    extract: function (value) {
        return value && value.properties && value.properties.platformFaultDomainCount || "N/A"
    }
}, {
    key: "timeCreated", label: 'Time Created', valueType: D.valueType.STRING, extract: function (value) {
        return value && value.properties && value.properties.timeCreated ? convertToUTC(value.properties.timeCreated) : "N/A"
    }
}];

/**
 * Generates Virtual Machine Scale Sets properties by extracting information from the defined virtualMachineScaleSetInfoExtractors.
 * @returns {Promise} A promise that resolves when Virtual Machine Scale Sets properties are generated.
 * It populates the global variable `virtualMachineScaleSetProperties` and concatenates them with `performanceMetrics`.
 */
function generateVirtualMachineScaleSetProperties() {
    return D.q.all(virtualMachineScaleSetInfoExtractors.map(function (extractorInfo) {
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
        virtualMachineScaleSetProperties = results.filter(function (result) {
            return result !== null
        }).concat(performanceMetrics);
    });
}


/**
 * Creates a table for displaying Azure Virtual Machine Scale Sets properties.
 * using the `D.createTable` method with the properties defined in `virtualMachineScaleSetProperties`.
 */
function createVirtualMachineScaleSetTable() {
    virtualMachineScaleSetTable = D.createTable('Azure Virtual Machine Scale Sets', virtualMachineScaleSetProperties.map(function (item) {
        const tableDef = {label: item.label, valueType: item.valueType};
        if (item.unit) {
            tableDef.unit = item.unit;
        }
        return tableDef;
    }));
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
function filterVirtualMachineScaleSetInfoListByResourceGroups(virtualMachineScaleSetInfoList) {
    if (!(resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all')) {
        return virtualMachineScaleSetInfoList.filter(function (virtualMachineScaleSet) {
            return resourceGroups.some(function (group) {
                return group.toLowerCase() === virtualMachineScaleSet.resourceGroup.toLowerCase()
            })
        });
    }
    return virtualMachineScaleSetInfoList;
}

/**
 * Filters the list of Virtual Machine Scale Set information by specified VM names.
 * @param {Array} virtualMachineScaleSetInfoList - A list of Virtual Machine Scale Set information objects.
 * @returns {Array} The filtered list of Virtual Machine Scale Set information based on VM names.
 */
function filterVirtualMachineScaleSetInfoListByVmNames(virtualMachineScaleSetInfoList) {
    if (!(vmNames.length === 1 && vmNames[0].toLowerCase() === 'all')) {
        return virtualMachineScaleSetInfoList.filter(function (virtualMachineScaleSet) {
            return vmNames.some(function (vmName) {
                return vmName.toLowerCase() === virtualMachineScaleSet.name.toLowerCase();
            });
        });
    }
    return virtualMachineScaleSetInfoList;
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
            virtualMachineScaleSetInfoList = filterVirtualMachineScaleSetInfoListByResourceGroups(filterVirtualMachineScaleSetInfoListByVmNames(virtualMachineScaleSetInfoList));
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
 * @returns {Promise} A promise that resolves when the record is inserted.
 */
function insertRecord(virtualMachineScaleSet) {
    const d = D.q.defer();
    const recordValues = virtualMachineScaleSetProperties.map(function (item) {
        const value = virtualMachineScaleSet[item.key] || 'N/A';
        return item.callback && value !== 'N/A' ? item.callback(value) : value;
    });
    virtualMachineScaleSetTable.insertRecord(virtualMachineScaleSet.id, recordValues);
    d.resolve();
    return d.promise;
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
 * Function to convert date to UTC format
 * @param {string} dateToConvert The date string to be converted
 * @returns {string} The date string in UTC format
 */
function convertToUTC(dateToConvert) {
    const date = new Date(dateToConvert)
    const month = (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1)
    const day = (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate()
    const year = date.getUTCFullYear()
    const hours = (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours()
    const minutes = (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes()
    const seconds = (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds()
    return month + "/" + day + "/" + year + " " + hours + ":" + minutes + ":" + seconds + " UTC"
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
    const maxGroupSize = 20;

    for (let i = 0; i < performanceMetrics.length; i += maxGroupSize) {
        performanceKeyGroups.push(performanceMetrics.slice(i, i + maxGroupSize).map(function (metric) {
            return metric.key
        }).join(','));
    }
    const promises = virtualMachineScaleSetInfoList.map(function (diskInfo) {
        const d = D.q.defer();
        const groupPromises = performanceKeyGroups.map(function (group) {
            return new Promise(function () {
                const config = generateConfig("/resourceGroups/" + diskInfo.resourceGroup + "/providers/Microsoft.Compute/virtualMachineScaleSets/" + diskInfo.name + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group + "&timespan=PT1M");
                azureCloudManagementService.http.get(config, processVirtualMachineScaleSetPerformanceResponse(d, diskInfo));
            });
        });
        D.q.all(groupPromises).then(function () {
            d.resolve(diskInfo)
        }).catch(d.reject);
        return d.promise;
    });
    return D.q.all(promises);
}

/**
 * Populates all Virtual Machine Scale Sets into the output table by calling insertRecord for each Virtual Machine Scale Set in the list.
 * @param {Array} virtualMachineScaleSetInfoList - A list of Virtual Machine Scale Set information objects to be inserted into the table.
 * @returns {Promise} A promise that resolves when all records have been inserted into the table.
 */
function populateTable(virtualMachineScaleSetInfoList) {
    const promises = virtualMachineScaleSetInfoList.map(insertRecord);
    return D.q.all(promises);
}

/**
 * Publishes the Virtual Machine Scale Sets table.
 */
function publishVirtualMachineScaleSetTable() {
    D.success(virtualMachineScaleSetTable);
}

/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(generateVirtualMachineScaleSetProperties)
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
        .then(generateVirtualMachineScaleSetProperties)
        .then(createVirtualMachineScaleSetTable)
        .then(retrieveVirtualMachineScaleSets)
        .then(retrieveVirtualMachineScaleSetsPerformanceMetrics)
        .then(populateTable)
        .then(publishVirtualMachineScaleSetTable)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}