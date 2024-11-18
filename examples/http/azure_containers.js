/**
 * Domotz Custom Driver
 * Name: Azure Containers
 * Description: Monitor Azure Containers: this script retrieves information about Containers.
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Name
 *
 **/

// Parameters for Azure authentication
const tenantId = D.getParameter('tenantID');
const clientId = D.getParameter('clientId');
const clientSecret = D.getParameter('clientSecret');
const subscriptionId = D.getParameter('subscriptionId');

const resourceGroups = D.getParameter('resourceGroups');
const containerNames = D.getParameter('containerNames');

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com');
const azureCloudManagementService = D.createExternalDevice('management.azure.com');

let accessToken;
// let containerGroupProperties;
let containerGroupsTable;

// This is the list of all allowed performance metrics that can be retrieved.
// To include a specific metric for retrieval, move it to the performanceMetrics list, and it will appear dynamically in the output table.
// const allowedPerformanceMetrics = [];


// This is the list of selected performance metrics retrieved.
// To exclude a specific metric from this list, move it to the allowedPerformanceMetrics list, and it will no longer appear dynamically in the output table.
const performanceMetrics = [{
    label: 'Cpu Usage', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'CpuUsage', callback: convertBytesToGb
}, {label: 'Memory Usage', valueType: D.valueType.NUMBER, unit: 'Gb', key: 'MemoryUsage', callback: convertBytesToGb}, {
    label: 'Network Received',
    valueType: D.valueType.NUMBER,
    unit: 'bps',
    key: 'NetworkBytesReceivedPerSecond',
    callback: convertBytesToGb
}, {
    label: 'Network Transmitted',
    valueType: D.valueType.NUMBER,
    unit: 'bps',
    key: 'NetworkBytesTransmittedPerSecond',
    callback: convertBytesToGb
}]

const containerDetailsExtractors = [{
    label: 'Image', key: 'containerImage', extract: function (container) {
        return container.properties && container.properties.image ? container.properties.image : "N/A";
    }
}, {
    label: 'Memory', key: 'containerResourcesMemory', unit: 'Gb', extract: function (container) {
        return container.properties && container.properties.resources && container.properties.resources.requests && container.properties.resources.requests.memoryInGB ? container.properties.resources.requests.memoryInGB : "N/A";
    }
}, {
    label: 'CPU', key: 'containerResourcesCPU', extract: function (container) {
        return container.properties && container.properties.resources && container.properties.resources.requests && container.properties.resources.requests.cpu ? container.properties.resources.requests.cpu : "N/A";
    }
}];

const containerGroupExtractors = [{
    key: 'containers', extract: function (value) {
        return value.properties.containers || [];
    }
}, {label: 'Resource Group', key: 'resourceGroup', extract: extractResourceGroup}, {
    label: 'Container Group', key: 'resourceName', extract: function (value) {
        return value.name || "N/A";
    }
}, {
    label: 'DNS Name Label', key: 'dnsNameLabel', extract: function (value) {
        return value.properties && value.properties.ipAddress && value.properties.ipAddress.dnsNameLabel ? value.properties.ipAddress.dnsNameLabel : "N/A";
    }
}, {
    label: 'IP Address', key: 'ipAddress', extract: function (value) {
        return value.properties && value.properties.ipAddress && value.properties.ipAddress.ip ? value.properties.ipAddress.ip : "N/A";
    }
}, {
    label: 'IP Address Type', key: 'ipAddressType', extract: function (value) {
        return value.properties && value.properties.ipAddress && value.properties.ipAddress.type ? value.properties.ipAddress.type : "N/A";
    }
}, {
    label: 'Location', key: 'location', extract: function (value) {
        return value.location || "N/A";
    }
}, {
    label: 'OS Type', key: 'osType', extract: function (value) {
        return value.properties && value.properties.osType ? value.properties.osType : "N/A";
    }
}, {
    label: 'Provisioning State', key: 'provisioningState', extract: function (value) {
        return value.properties && value.properties.provisioningState ? value.properties.provisioningState : "N/A";
    }
}, {
    label: 'Restart Policy', key: 'restartPolicy', extract: function (value) {
        return value.properties && value.properties.restartPolicy ? value.properties.restartPolicy : "N/A";
    }
}];

/**
 * Generates Container Group Machine properties by extracting information from the defined containerGroupConfigExtractors.
 * @returns {Array} return concatenation of `containerDetailsExtractors`, `containerGroupConfigExtractors` and `performanceMetrics`.
 */
function generateContainerGroupProperties() {
    return containerDetailsExtractors.concat(containerGroupExtractors).concat(performanceMetrics).filter(function (result) {
        return result.label
    });
}

/**
 * Creates a table for displaying Azure Container Group properties.
 */
function createContainerGroupTable(containerGroupProperties) {
    containerGroupsTable = D.createTable('Azure Containers', containerGroupProperties);
}

/**
 * Extracts the resource group from the Container Group object.
 * @param {Object} containerGroup - The Container Group object containing the resource group information in its ID.
 * @returns {string} The name of the resource group, or "N/A" if not found.
 */
function extractResourceGroup(containerGroup) {
    let resourceGroup = "N/A";
    if (containerGroup.id) {
        const resourceGroupMatch = containerGroup.id.match(/\/resourceGroups\/([^\/]*)\//);
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
 * Filters the list of Container Group information by specified resource groups.
 * @param {Array} containerGroupInfoList - A list of Container Group information objects.
 * @returns {Array} The filtered list of Container Group information based on resource groups.
 */
function filterContainerGroupInfoList(containerGroupInfoList) {
    return containerGroupInfoList.filter(function (containerGroup) {
        return containerGroup.containers.length && ((resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') || resourceGroups.some(function (group) {
            return group.toLowerCase() === containerGroup.resourceGroup.toLowerCase()
        })) && ((containerNames.length === 1 && containerNames[0].toLowerCase() === 'all') || containerNames.some(function (containerName) {
                return containerName.toLowerCase() === containerGroup.resourceName.toLowerCase()
            }))
    });
}

// /**
//  * Filters the list of Container Group information by specified container names.
//  * @param {Array} containerGroupInfoList - A list of Container Group information objects.
//  * @returns {Array} The filtered list of Container Group information based on Container names.
//  */
// function filterContainerGroupInfoListByContainerNames(containerGroupInfoList) {
//     if (!(containerNames.length === 1 && containerNames[0].toLowerCase() === 'all')) {
//         return containerGroupInfoList.filter(function (containerGroup) {
//             return containerNames.some(function (containerName) {
//                 return containerName.toLowerCase() === containerGroup.containerName.toLowerCase();
//             });
//         });
//     }
//     return containerGroupInfoList;
// }

// /**
//  * Filters the list of Container Group information by specified container names.
//  * @param {Array} containerGroupInfoList - A list of Container Group information objects.
//  * @returns {Array} The filtered list of Container Group information based on Container names.
//  */
// function filterContainerGroupHadContainers(containerGroupInfoList) {
//     return containerGroupInfoList.filter(function (containerGroup) {
//         return containerGroup.containers.length;
//     });
// }

/**
 * Processes the response from the Container Groups API call, extracts Container Groups data, and populates the table.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processContainerGroupsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) {
            D.failure(D.errorType.GENERIC_ERROR)
            d.reject("No Container Groups found in the response");
            return;
        }
        let containerGroupInfoList = bodyAsJSON.value.map(extractContainerGroupInfo);
        if (!containerGroupInfoList.length) {
            console.info('There is no Container Group');
        } else {
            containerGroupInfoList = filterContainerGroupInfoList(containerGroupInfoList);
        }
        d.resolve(containerGroupInfoList);
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
 * Extracts relevant Container Group information from a Container Group object returned by the Azure API.
 * @param {Object} containerGroup - The Container Group object containing various properties, including IDs, hardware profile, and storage profile.
 * @returns {Object|null} An object containing the extracted Container Group information, or null if the Container Group object is invalid.
 */
function extractContainerGroupInfo(containerGroup) {
    if (!containerGroup || !containerGroup.properties || !containerGroup.name) return null;
    const extractedInfo = {};
    containerGroupExtractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(containerGroup);
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
 * Generates a md5 hash of the provided value.
 * @param {string} value - The input string to hash.
 * @returns {string} The md5 hash of the input value in hexadecimal format.
 */
function md5(value) {
    return D.crypto.hash(value, "md5", null, "hex");
}

/**
 * Inserts a containerGroup record into the containerGroup table with the given containerGroup information.
 * @param {Object} container - The containerGroup information object.
 * @param containerGroupProperties
 */
function insertRecord(container, containerGroupProperties) {
    const recordValues = containerGroupProperties.map(function (item) {
        const value = container[item.key] || "N/A";
        return item.callback ? item.callback(value) : value;
    });
    containerGroupsTable.insertRecord(sanitize(md5(container.resourceGroup + container.resourceName + container.containerName)), recordValues);
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
 * Retrieves a list of Azure Container Groups for the configured or all resource groups.
 * @returns {Promise} A promise that resolves with the Container Group data upon successful retrieval from the Azure API.
 */
function retrieveContainerGroups() {
    const d = D.q.defer();
    const config = generateConfig("/providers/Microsoft.ContainerInstance/containerGroups?api-version=2024-05-01-preview");
    azureCloudManagementService.http.get(config, processContainerGroupsResponse(d));
    return d.promise;
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
 * Extracts performance metrics for a Container Group and populates the Container Group info object.
 * @param {Object} performanceInfo - The performance metrics information for the Container Group.
 * @param {Object} containerGroupInfo - The Container Group information object to populate with performance metrics.
 */
function extractContainerGroupPerformance(performanceInfo, containerGroupInfo) {
    if (performanceInfo.name.value) {
        if (performanceInfo.timeseries && performanceInfo.timeseries[0] && performanceInfo.timeseries[0].data) {
            const key = getNonTimeStampKey(performanceInfo.timeseries[0].data);
            containerGroupInfo[performanceInfo.name.value] = key ? performanceInfo.timeseries[0].data[0][key] : "N/A";
        } else {
            containerGroupInfo[performanceInfo.name.value] = "N/A"
        }
    }
}

/**
 * Processes the response from the Container Groups API call and populates the table with Container Group data.
 * @param {Object} d - The deferred promise object.
 * @param {Object} containerGroupInfo - The Container Group information object containing resource group and Container Group details.
 * @returns {Function} A function to process the HTTP response.
 */
function processContainerGroupPerformanceResponse(d, containerGroupInfo) {
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
                extractContainerGroupPerformance(performanceInfo, containerGroupInfo)
            });
            d.resolve(containerGroupInfo);
        } catch (parseError) {
            console.error("Error parsing Container Groups configuration:", parseError);
            d.reject("Failed to parse response for " + containerGroupInfo.name);
        }
    }
}

/**
 * Retrieves performance metrics for a list of Container Groups.
 * @param {Array} containerGroupInfoList - The list of Container Group information objects.
 * @returns {Promise} - A promise that resolves with an array of vContainer Groupirtual machine information objects.
 */
function retrieveContainerGroupsPerformanceMetrics(containerGroupInfoList) {
    const performanceKeyGroups = [];
    const promises = []
    const maxGroupSize = 20;
    for (let i = 0; i < performanceMetrics.length; i += maxGroupSize) {
        performanceKeyGroups.push(performanceMetrics.slice(i, i + maxGroupSize).map(function (metric) {
            return metric.key
        }).join(','));
    }
    containerGroupInfoList.map(function (containerGroupInfo) {
        performanceKeyGroups.map(function (group) {
            const d = D.q.defer();
            const config = generateConfig("/resourceGroups/" + containerGroupInfo.resourceGroup + "/providers/Microsoft.ContainerInstance/containerGroups/" + containerGroupInfo.resourceName + "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group + "&timespan=PT1M");
            azureCloudManagementService.http.get(config, function (error, response, body) {
                processContainerGroupPerformanceResponse(d, containerGroupInfo)(error, response, body);
            });
            promises.push(d.promise);
        });
    });
    return D.q.all(promises);
}

/**
 * Populates all Container Groups into the output table by calling insertRecord for each Container Group in the list.
 * @param {Array} containerGroupInfoList - A list of Container Group information objects to be inserted into the table.
 * @param containerGroupProperties
 */
function populateTable(containerGroupInfoList, containerGroupProperties) {
    containerGroupInfoList.map(function (groupInfo) {
        groupInfo.containers.forEach(function (containerInfo) {
            containerDetailsExtractors.map(function (containerExtractor) {
                groupInfo[containerExtractor.key] = containerExtractor.extract(containerInfo);
            })
        })
        insertRecord(groupInfo, containerGroupProperties)
    })
}

/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(retrieveContainerGroups)
        .then(retrieveContainerGroupsPerformanceMetrics)
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
 * @label Get Azure Container Groups
 * @documentation This procedure is used to extract Azure Container Groups.
 */
function get_status() {
    login()
        .then(retrieveContainerGroups)
        .then(retrieveContainerGroupsPerformanceMetrics)
        .then(function (containerGroupInfoList) {
            const containerGroupProperties = generateContainerGroupProperties()
            createContainerGroupTable(containerGroupProperties)
            populateTable(containerGroupInfoList, containerGroupProperties)
            D.success(containerGroupsTable);
        })
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}