/**
 * Domotz Custom Driver
 * Name: Azure Disks Information
 * Description: Monitor Azure Compute Disks: this script retrieves information about Disk.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Name
 *      - Resource Group
 *      - Location of the resource
 *      - Availability zone
 *      - SKU name
 *      - SKU tier
 *      - Os
 *      - Hyper-V generation
 *      - Supports hibernation
 *      - Accelerated networking support
 *      - Architecture
 *      - Disk creation option
 *      - Disk size
 *      - Disk IOPS for read/write
 *      - Disk throughput for read/write
 *      - Encryption type
 *      - Network access policy
 *      - Public network access policy
 *      - Creation time of the disk
 *      - Provisioning state
 *      - Disk state
 *      - Disk tier
 *      - Composite Disk Read
 *      - Composite Disk Write
 *      - Composite Disk Read Ops
 *      - Composite Disk Write Ops
 *      - Disk On-demand Burst Ops
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
let diskProperties
let diskTable;

// This is the list of all allowed performance metrics that can be retrieved.
// To include a specific metric for retrieval, move it to the performanceMetrics list, and it will appear dynamically in the output table.
// const allowedPerformanceMetrics = []

// This is the list of selected performance metrics retrieved.
// To exclude a specific metric from this list, move it to the allowedPerformanceMetrics list, and it will no longer appear dynamically in the output table.
const performanceMetrics = [
    {label: 'Composite Disk Read', valueType: D.valueType.NUMBER, key: 'Composite Disk Read Bytes/sec', unit: 'bps'},
    {label: 'Composite Disk Write', valueType: D.valueType.NUMBER, key: 'Composite Disk Write Bytes/sec', unit: 'bps'},
    {label: 'Composite Disk Read Ops', valueType: D.valueType.NUMBER, key: 'Composite Disk Read Operations/sec', unit: 'ops/sec'},
    {label: 'Composite Disk Write Ops', valueType: D.valueType.NUMBER, key: 'Composite Disk Write Operations/sec', unit: 'ops/sec'},
    {label: 'Disk On-demand Burst Ops', valueType: D.valueType.NUMBER, key: 'DiskPaidBurstIOPS'}
]

const diskInfoExtractors = [
    {key: "id", extract: function (disk) {return sanitize(disk.properties.uniqueId)}},
    {label: 'Name', valueType: D.valueType.STRING, key: 'name', extract: function (disk) {return disk.name || "N/A";}},
    {label: 'Resource Group', valueType: D.valueType.STRING, key: "resourceGroup", extract: extractResourceGroup},
    {label: 'Location of the resource', valueType: D.valueType.STRING, key: "location", extract: function (disk) {return disk.location || "N/A";}},
    {label: 'Availability zone', valueType: D.valueType.STRING, key: "availabilityZone", extract: function (disk) {return disk.zones ? disk.zones.join(", ") : "N/A";}},
    {label: 'SKU name', valueType: D.valueType.STRING, key: "skuName", extract: function (disk) {return disk.sku.name || "N/A";}},
    {label: 'SKU tier', valueType: D.valueType.STRING, key: "skuTier", extract: function (disk) {return disk.sku.tier || "N/A";}},
    {label: 'Os', valueType: D.valueType.STRING, key: "osType", extract: function (disk) {return disk.properties.osType || "N/A";}},
    {label: 'Hyper-V generation', valueType: D.valueType.STRING, key: "hyperVGeneration", extract: function (disk) {return disk.properties.hyperVGeneration || "N/A";}},
    {label: 'Supports hibernation', valueType: D.valueType.STRING, key: "supportsHibernation", extract: function (disk) {return disk.properties.supportsHibernation ? "Yes" : "No";}},
    {label: 'Accelerated networking support', valueType: D.valueType.STRING, key: "acceleratedNetworking", extract: function (disk) {return disk.properties.supportedCapabilities.acceleratedNetwork ? "Supported" : "Not Supported";}},
    {label: 'Architecture', valueType: D.valueType.STRING, key: "architecture", extract: function (disk) {return disk.properties.supportedCapabilities.architecture || "N/A";}},
    {label: 'Disk creation option', valueType: D.valueType.STRING, key: "createOption", extract: function (disk) {return disk.properties.creationData.createOption || "N/A";}},
    {label: 'Disk size', valueType: D.valueType.NUMBER, key: "diskSizeGB", extract: function (disk) {return disk.properties.diskSizeGB || 0;}},
    {label: 'Disk IOPS for read/write', valueType: D.valueType.NUMBER, key: "diskIOPS", extract: function (disk) {return disk.properties.diskIOPSReadWrite || 0;}},
    {label: 'Disk throughput for read/write', valueType: D.valueType.NUMBER, key: "diskThroughput", extract: function (disk) {return disk.properties.diskMBpsReadWrite || 0;}},
    {label: 'Encryption type', valueType: D.valueType.STRING, key: "encryptionType", extract: function (disk) {return disk.properties.encryption.type || "N/A";}},
    {label: 'Network access policy', valueType: D.valueType.STRING, key: "networkAccessPolicy", extract: function (disk) {return disk.properties.networkAccessPolicy || "N/A";}},
    {label: 'Public network access policy', valueType: D.valueType.STRING, key: "publicNetworkAccess", extract: function (disk) {return disk.properties.publicNetworkAccess || "N/A";}},
    {label: 'Creation time of the disk', valueType: D.valueType.STRING, key: 'timeCreated', callback: convertToUTC, extract: function (disk) {return disk.properties.timeCreated || "N/A";}},
    {label: 'Provisioning state', valueType: D.valueType.STRING, key: "provisioningState", extract: function (disk) {return disk.properties.provisioningState || "N/A";}},
    {label: 'Disk state', valueType: D.valueType.STRING, key: "diskState", extract: function (disk) {return disk.properties.diskState || "N/A";}},
    {label: 'Disk tier', valueType: D.valueType.STRING, key: "diskTier", extract: function (disk) {return disk.properties.tier || "N/A";}}
];

/**
 * Generates disk properties by extracting information from the defined diskInfoExtractors.
 * @returns {Promise} A promise that resolves when disk properties are generated.
 * It populates the global variable `diskProperties` and concatenates them with `performanceMetrics`.
 */
function generateDiskProperties() {
    return D.q.all(
        diskInfoExtractors.map(function(extractorInfo) {
            return new Promise(function(resolve) {
                if (extractorInfo.key !== 'id') {
                    resolve({'key': extractorInfo.key, 'label': extractorInfo.label, 'valueType': extractorInfo.valueType, 'unit':extractorInfo.unit ? extractorInfo.unit: null});
                } else {
                    resolve(null);
                }
            });
        })
    ).then(function(results) {
        diskProperties = results.filter(function(result){ return result !== null }).concat(performanceMetrics);
    });
}

/**
 * Creates a table for displaying Azure Disk properties.
 * using the `D.createTable` method with the properties defined in `diskProperties`.
 */
function createDiskTable() {
    diskTable = D.createTable('Azure Disks', diskProperties.map(function (item) {
        const tableDef = {label: item.label, valueType: item.valueType};
        if (item.unit) {
            tableDef.unit = item.unit;
        }
        return tableDef;
    }));
}

/**
 * Extracts the resource group from the disk object.
 * @param {Object} disk - The disk object containing the resource group information in its ID.
 * @returns {string} The name of the resource group, or "N/A" if not found.
 */
function extractResourceGroup(disk) {
    let resourceGroup = "N/A";
    if (disk.id) {
        const resourceGroupMatch = disk.id.match(/\/resourceGroups\/([^\/]*)\//);
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
 * Filters the list of disk information by specified resource groups.
 * @param {Array} diskInfoList - A list of disk information objects.
 * @returns {Array} The filtered list of disk information based on resource groups.
 */
function filterDiskInfoListByResourceGroups(diskInfoList) {
    if (!(resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all')) {
        return diskInfoList.filter(function (disk) {
            return resourceGroups.some(function (group) {
                return group.toLowerCase() === disk.resourceGroup.toLowerCase()
            })
        });
    }
    return diskInfoList;
}

/**
 * Filters the list of disk information by specified VM names.
 * @param {Array} diskInfoList - A list of Disk information objects.
 * @returns {Array} The filtered list of Disk information based on VM names.
 */
function filterDiskInfoListByVmNames(diskInfoList) {
    if (!(vmNames.length === 1 && vmNames[0].toLowerCase() === 'all')) {
        return diskInfoList.filter(function (disk) {
            return vmNames.some(function (vmName) {
                return vmName.toLowerCase() === disk.name.toLowerCase();
            });
        });
    }
    return diskInfoList;
}

/**
 * Processes the response from the Disks API call and extracts disk information.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processDisksResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            D.failure(D.errorType.GENERIC_ERROR)
            d.reject("No Disks found in the response");
            return;
        }
        let diskInfoList = bodyAsJSON.value.map(extractDiskInfo);
        if (!diskInfoList.length) {
            console.info('There is no Virtual machine');
        } else {
            diskInfoList = filterDiskInfoListByResourceGroups(filterDiskInfoListByVmNames(diskInfoList));
        }
        d.resolve(diskInfoList);
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
 * Extracts necessary information from a disk object.
 * @param {Object} disk - The disk object containing various properties.
 * @returns {Object|null} The extracted disk information or empty object.
 */
function extractDiskInfo(disk) {
    if (!disk || !disk.properties || !disk.properties.uniqueId) return null;
    const extractedInfo = {};
    diskInfoExtractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(disk);
    });
    return extractedInfo;
}

/**
 * Inserts a record into the disk table.
 * @param {Object} disk - The disk information to insert into the table.
 * @returns {Promise} A promise that resolves when the record is inserted.
 */
function insertRecord(disk) {
    const d = D.q.defer();
    const recordValues = diskProperties.map(function (item) {
        const value = disk[item.key] || 'N/A';
        return item.callback && value !== "N/A" ? item.callback(value) : value;
    });
    diskTable.insertRecord(disk.id, recordValues);
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
 * Retrieves Azure disks for the subscription.
 * @returns {Promise} A promise that resolves with the disk data.
 */
function retrieveDisks() {
    const d = D.q.defer();
    const config = generateConfig("/providers/Microsoft.Compute/disks?api-version=2021-04-01");
    azureCloudManagementService.http.get(config, processDisksResponse(d));
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
 * Extracts disk performance data and updates the disk information.
 * @param {Object} performanceInfo - The performance information object.
 * @param {Object} diskInfo - The disk information to update.
 */
function extractDiskPerformance(performanceInfo, diskInfo) {
    if (performanceInfo.name.value) {
        if (performanceInfo.timeseries && performanceInfo.timeseries[0] && performanceInfo.timeseries[0].data) {
            const key = getNonTimeSeriesKey(performanceInfo.timeseries[0].data);
            diskInfo[performanceInfo.name.value] = key ? performanceInfo.timeseries[0].data[0][key] : "N/A";
        }else{
            diskInfo[performanceInfo.name.value] = "N/A"
        }
    }
}

/**
 * Processes the disk performance API response and updates the disk information.
 * @param {Object} d - The deferred promise object.
 * @param {Object} diskInfo - The disk information to update.
 * @returns {Function} A function to process the HTTP response.
 */
function processDiskPerformanceResponse(d, diskInfo) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        if (error || response.statusCode !== 200) {return;}
        try {
            const bodyAsJSON = JSON.parse(body);
            if (!bodyAsJSON.value) {
                D.failure(D.errorType.GENERIC_ERROR)
                return;
            }
            bodyAsJSON.value.map(function (performanceInfo) {
                extractDiskPerformance(performanceInfo, diskInfo)
            });
            d.resolve(diskInfo);
        } catch (parseError) {
            console.error("Error parsing Disks configuration:", parseError);
            d.reject("Failed to parse response for " + diskInfo.name);
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
 * Retrieves performance metrics for each disk in the provided disk information list.
 * @param {Array} diskInfoList - A list of disk information objects.
 * @returns {Promise} A promise that resolves when all performance metrics have been retrieved.
 */
function retrieveDisksPerformanceMetrics(diskInfoList) {
    const performanceKeyGroups = [];
    const maxGroupSize = 20;

    for (let i = 0; i < performanceMetrics.length; i += maxGroupSize) {
        performanceKeyGroups.push(
            performanceMetrics.slice(i, i + maxGroupSize).map(function (metric) {
                return metric.key
            }).join(',')
        );
    }
    const promises = diskInfoList.map(function (diskInfo) {
        const d = D.q.defer();
        const groupPromises = performanceKeyGroups.map(function (group) {
            return new Promise(function () {
                const config = generateConfig("/resourceGroups/" + diskInfo.resourceGroup + "/providers/Microsoft.Compute/disks/" + diskInfo.name + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group + "&timespan=PT1M");
                azureCloudManagementService.http.get(config, processDiskPerformanceResponse(d, diskInfo));
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
 * Populates all disks into the output table by calling insertRecord for each Disk in the list.
 * @param {Array} diskInfoList - A list of Disk information objects to be inserted into the table.
 * @returns {Promise} A promise that resolves when all records have been inserted into the table.
 */
function populateTable(diskInfoList) {
    const promises = diskInfoList.map(insertRecord);
    return D.q.all(promises);
}

/**
 * Publishes the Disks table.
 */
function publishDiskTable() {
    D.success(diskTable);
}

/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(generateDiskProperties)
        .then(retrieveDisks)
        .then(retrieveDisksPerformanceMetrics)
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
 * @label Get Azure disks
 * @documentation This procedure is used to extract Azure Disks.
 */
function get_status() {
    login()
        .then(generateDiskProperties)
        .then(createDiskTable)
        .then(retrieveDisks)
        .then(retrieveDisksPerformanceMetrics)
        .then(populateTable)
        .then(publishDiskTable)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}