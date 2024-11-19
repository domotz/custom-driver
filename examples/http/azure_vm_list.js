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
 *      - OS Type
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
 *
 **/

// Parameters for Azure authentication
const tenantId = D.getParameter('tenantID');
const clientId = D.getParameter('clientId');
const clientSecret = D.getParameter('clientSecret');
const subscriptionId = D.getParameter('subscriptionId');

const resourceGroups = D.getParameter('resourceGroups');
const vmNames = D.getParameter('vmNames');

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com');
const azureCloudManagementService = D.createExternalDevice('management.azure.com');

let accessToken;
let vmTable;

const vmInfoExtractors = [{
    key: "id", extract: function (vm) {
        return sanitize(vm.properties.vmId)
    }
}, {
    label: 'Name', valueType: D.valueType.NUMBER, key: 'vmName', extract: function (vm) {
        return vm.name || "N/A"
    }
}, {label: 'Resource Group', valueType: D.valueType.STRING, key: 'resourceGroup', extract: extractResourceGroup}, {
    label: 'OS Type', valueType: D.valueType.STRING, key: 'osType', extract: function (vm) {
        return (vm.properties.storageProfile && vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.osType) || "N/A"
    }
}, {
    label: 'Location', valueType: D.valueType.STRING, key: 'location', extract: function (vm) {
        return vm.location || "N/A"
    }
}, {
    label: 'Size', valueType: D.valueType.STRING, key: 'size', extract: function (vm) {
        return (vm.properties.hardwareProfile && vm.properties.hardwareProfile.vmSize) || "N/A"
    }
}, {
    label: 'Image Publisher', valueType: D.valueType.STRING, key: 'imagePublisher', extract: function (vm) {
        return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.publisher) || "N/A"
    }
}, {
    label: 'Image', valueType: D.valueType.STRING, key: 'imageOffer', extract: function (vm) {
        return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.offer) || "N/A"
    }
}, {
    label: 'Image Version', valueType: D.valueType.STRING, key: 'imageVersion', extract: function (vm) {
        return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.exactVersion) || "N/A"
    }
}, {
    label: 'Image SKU', valueType: D.valueType.STRING, key: 'imageSku', extract: function (vm) {
        return (vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.sku) || "N/A"
    }
}, {
    label: 'Data Disks', valueType: D.valueType.STRING, key: 'dataDisks', extract: function (vm) {
        return (vm.properties.storageProfile && vm.properties.storageProfile.dataDisks && vm.properties.storageProfile.dataDisks.length ? vm.properties.storageProfile.dataDisks.join(', ') : "N/A")
    }
}, {
    label: 'Provisioning State', valueType: D.valueType.STRING, key: 'provisioningState', extract: function (vm) {
        return vm.properties.provisioningState || "N/A"
    }
}, {
    label: 'Hibernation Enabled', valueType: D.valueType.STRING, key: 'hibernationEnabled', extract: function (vm) {
        return (vm.properties.additionalCapabilities && vm.properties.additionalCapabilities.hibernationEnabled && vm.properties.additionalCapabilities.hibernationEnabled === true) ? "Yes" : "No"
    }
}, {
    label: 'Managed Disk', valueType: D.valueType.STRING, key: 'managedDisk', extract: function (vm) {
        return (vm.properties.storageProfile && vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.name) || "N/A"
    }
}, {
    label: 'Computer Name', valueType: D.valueType.STRING, key: 'computerName', extract: function (vm) {
        return (vm.properties.osProfile && vm.properties.osProfile.computerName) || "N/A"
    }
}, {
    label: 'Network Interfaces',
    valueType: D.valueType.STRING,
    key: 'networkInterfaces',
    extract: extractNetworkInterfaces
}, {
    label: 'Zone', valueType: D.valueType.STRING, key: 'zone', extract: function (vm) {
        return (vm.zones && vm.zones[0]) || "N/A"
    }
}];

/**
 * Generates Virtual Machine properties by extracting information from the defined vmConfigExtractors.
 * @returns {Array} return `vmProperties`.
 */
function generateVirtualMachineProperties() {
    return vmInfoExtractors.filter(function (result) {
        return result.label
    });
}

/**
 * Creates a table for displaying Azure Virtual Machine properties.
 */
function createVirtualMachineTable(vmProperties) {
    vmTable = vmTable = D.createTable('Azure Virtual Machines', vmProperties.map(function (item) {
        const tableDef = {label: item.label, valueType: item.valueType};
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
        return vm.properties.networkProfile.networkInterfaces.map(function (ni) {
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
 * Filters the list of VM information.
 * @param {Array} vmInfoList - A list of VM information objects.
 * @returns {Array} The filtered list of VM information.
 */
function filterVmInfoList(vmInfoList) {
    return vmInfoList.filter(function (vmInfo) {
        return ((resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') || resourceGroups.some(function (resourceGroup) {
            return resourceGroup.toLowerCase() === vmInfo.resourceGroup.toLowerCase()
        })) && ((vmNames.length === 1 && vmNames[0].toLowerCase() === 'all') || vmNames.some(function (vmName) {
            return vmName.toLowerCase() === vmInfo.name.toLowerCase();
        }))
    });
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
            vmInfoList = filterVmInfoList(vmInfoList);
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
 * Extracts relevant VM information from a VM object returned by the Azure API.
 * @param {Object} vm - The VM object containing various properties, including IDs, hardware profile, and storage profile.
 * @returns {Object|null} An object containing the extracted VM information, or null if the VM object is invalid.
 */
function extractVmInfo(vm) {
    if (!vm || !vm.properties || !vm.properties.vmId) return null;

    const extractedInfo = {};

    vmInfoExtractors.forEach(function (row) {
        extractedInfo[row.key] = row.extract(vm);
    });
    return extractedInfo;
}

/**
 * Inserts a VM record into the VM table with the given VM information.
 * @param {Object} vm - The VM information object.
 * @param vmProperties
 */
function insertRecord(vm, vmProperties) {
    const recordValues = vmProperties.map(function (item) {
        const value = vm[item.key] || "N/A";
        return item.callback ? item.callback(value) : value;
    });
    vmTable.insertRecord(vm.id, recordValues);
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
 * Populates all VMs into the output table by calling insertRecord for each VM in the list.
 * @param {Array} vmInfoList - A list of VM information objects to be inserted into the table.
 * @param vmProperties
 * @returns {Promise} A promise that resolves when all records have been inserted into the table.
 */
function populateTable(vmInfoList, vmProperties) {
    vmInfoList.map(function (vmInfo) {
        insertRecord(vmInfo, vmProperties)
    });
}

/**
 * @remote_procedure
 * @label Validate Azure connection
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    login()
        .then(retrieveVMs)
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
    vmInfoExtractors
    login()
        .then(retrieveVMs)
        .then(function (virtualMachineScaleSetInfoList) {
            const vmProperties = generateVirtualMachineProperties()
            createVirtualMachineTable(vmProperties)
            populateTable(virtualMachineScaleSetInfoList, vmProperties)
            D.success(vmTable);
        })
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}