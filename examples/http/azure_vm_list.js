/**
 * Domotz Custom Driver
 * Name: Azure VMs List
 * Description: Monitor Azure Compute Virtual Machines: this script retrieves information about Virtual Machine image, operating system, resource group, size and location .
 *
 * Communication protocol is HTTPS
 *
 * Output:
 * Extracts the following information from the data array:
 *      - Name
 *      - OS
 *      - Location
 *      - Size
 *      - Image Publisher
 *      - Image
 *      - Image Version
 *      - Resource Group
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
 * @description resourceGroup
 * @type STRING
 */
const resourceGroup = D.getParameter('resourceGroup');

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com');
const azureCloudManagementService = D.createExternalDevice('management.azure.com');

let accessToken;

const vmTable = D.createTable('Azure Virtual Machines', [
    {label: 'Name', valueType: D.valueType.STRING},
    {label: 'OS', valueType: D.valueType.STRING},
    {label: 'Location', valueType: D.valueType.STRING},
    {label: 'Size', valueType: D.valueType.STRING},
    {label: 'Image Publisher', valueType: D.valueType.STRING},
    {label: 'Image', valueType: D.valueType.STRING},
    {label: 'Image Version', valueType: D.valueType.STRING},
    {label: 'Resource Group', valueType: D.valueType.STRING}
])

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
 * Processes the login response, extracting the access token.
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
 * Processes the response from the VMs API call and populates the table with VM data.
 * @param {Object} d - The deferred promise object.
 * @returns {Function} A function to process the HTTP response.
 */
function processVMsResponse(d) {
    return function process(error, response, body) {
        checkHTTPError(error, response);
        const bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value) D.failure(D.errorType.GENERIC_ERROR);

        let vmInfoList = bodyAsJSON.value.map(extractVmInfo);
        if (resourceGroup.toString().toLowerCase() !== "all") {
            const allVmLength = vmInfoList.length
            vmInfoList = vmInfoList.filter(function (vm) {
                return resourceGroup === vm.resourceGroup;
            });
            if (!allVmLength) {
                console.info('There is no Virtual machine');
            } else if ( vmInfoList.length === 0) {
                console.info('There is no Virtual machine related to this Resource Group');
            }
        }

        vmInfoList.map(populateTable);
        d.resolve();
    }
}

/**
 * Logs in to Azure cloud service
 * @returns A promise that resolves on successful login
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
 * Extracts necessary information from a VM object.
 * @param {Object} vm - The VM object containing various properties.
 * @returns {Object|null} The extracted VM information or null if invalid.
 */
function extractVmInfo(vm) {
    if (!vm || !vm.properties || !vm.properties.vmId) return null;

    const id = sanitize(vm.properties.vmId);
    const vmName = vm.name || "N/A";
    const location = vm.location || "N/A";
    const size = vm.properties.hardwareProfile && vm.properties.hardwareProfile.vmSize || "N/A";
    const osType = vm.properties.storageProfile && vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.osType || "N/A";
    const imagePublisher = vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.publisher || "N/A";
    const imageName = vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.offer || "N/A";
    const imageVersion = vm.properties.storageProfile && vm.properties.storageProfile.imageReference && vm.properties.storageProfile.imageReference.version || "N/A";

    let resourceGroup = "N/A";
    if (vm.id) {
        const resourceGroupMatch = vm.id.match(/\/resourceGroups\/([^\/]*)\//);
        if (resourceGroupMatch && resourceGroupMatch[1]) resourceGroup = resourceGroupMatch[1];
    }

    return {
        id, vmName, location, size, osType, imagePublisher, imageName, imageVersion, resourceGroup
    };
}

/**
 * Populates a table with VM information.
 * @param {Object} vm - The VM information to insert into the table.
 */
function populateTable(vm) {
    vmTable.insertRecord(vm.id, [vm.vmName, vm.osType, vm.location, vm.size, vm.imagePublisher, vm.imageName, vm.imageVersion, vm.resourceGroup]);
}

/**
 * Retrieve Azure VMs for the configured or all resource groups
 * @returns A promise that resolves on successful login
 */
function retrieveVMs() {
    const d = D.q.defer();
    const config = {
        url: "/subscriptions/" + subscriptionId + "/providers/Microsoft.Compute/virtualMachines?api-version=2021-04-01",
        protocol: "https",
        headers: {
            "Authorization": "Bearer " + accessToken,
        },
        rejectUnauthorized: false,
        jar: true
    };
    azureCloudManagementService.http.get(config, processVMsResponse(d));
    return d.promise;
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
        .then(publishVMTable)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}