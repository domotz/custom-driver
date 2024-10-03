/**
 * @description tenantID
 * @type STRING 
 */
var tenantID = D.getParameter('tenantID');

/**
 * @description client_id
 * @type STRING 
 */
var client_id = D.getParameter('client_id');

/**
 * @description client_secret
 * @type SECRET_TEXT 
 */
var client_secret = D.getParameter('client_secret');

/**
 * @description subscriptionId
 * @type STRING 
 */
var subscriptionId = D.getParameter('subscriptionId');

/**
 * @description resourceGroup
 * @type STRING 
 */
var resourceGroups = D.getParameter('resourceGroups');

const azureCloudLoginService = D.createExternalDevice('login.microsoftonline.com');
const azureCloudManagementService = D.createExternalDevice('management.azure.com');

var accessToken;
var resourceGroupsToCheck = [];

var vmTable = D.createTable(
    'Azure Virtual Machines',
    [
      { label: 'Name', valueType: D.valueType.STRING },
      { label: 'OS', valueType: D.valueType.STRING },
      { label: 'Location', valueType: D.valueType.STRING },
      { label: 'Size', valueType: D.valueType.STRING},
      { label: 'Image Publisher', valueType: D.valueType.STRING },      
      { label: 'Image', valueType: D.valueType.STRING },            
      { label: 'Image Version', valueType: D.valueType.STRING },                  
      { label: 'Resource Group', valueType: D.valueType.STRING },
    ]
)

function checkHTTPError(error, response) {
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) 
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        else if (response.statusCode == 401 || response.statusCode == 403) 
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        else if (response.statusCode != 200)
            D.failure(D.errorType.GENERIC_ERROR);
}

function processLoginResponse(d) 
{
    return function process(error, response, body) {
        checkHTTPError(error, response);

        var bodyAsJSON = JSON.parse(body);
        if (bodyAsJSON.access_token) {
            accessToken = bodyAsJSON.access_token;
            d.resolve();            
        }
        else {
            console.error("Access token not found in response body");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
    }
}

/**
 * Logs in to Azure cloud service
 * @returns A promise that resolves on successful login
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/"+tenantID+"/oauth2/token",
        protocol: "https",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        form: {
            grant_type: "client_credentials",
            client_id: client_id,
            client_secret: client_secret,
            resource:"https://management.azure.com\/"
        },        
        rejectUnauthorized: false,
        jar: true
    };
    azureCloudLoginService.http.post(config, processLoginResponse(d));
    return d.promise;
}

function processResourceGroupsResponse(d) 
{
    return function process(error, response, body) {
        checkHTTPError(error, response);

        var bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value)
            D.failure(D.errorType.GENERIC_ERROR);

        bodyAsJSON.value.forEach(function (resourceGroup) {
            if (resourceGroup.name) 
                resourceGroupsToCheck.push(resourceGroup.name);
            });
        d.resolve();
    };
}

/**
 * Retrieve Azure resource groups
 * @returns A promise that resolves on successful request
 */
function retrieveResourceGroups() {
    var d = D.q.defer();    
    if (resourceGroups.length === 1 && resourceGroups[0].toLowerCase() === 'all') {

        var config = {
            url: "/subscriptions/" + subscriptionId+"/resourceGroups?api-version=2021-04-01",
            protocol: "https",
            headers: {
                "Authorization": "Bearer " + accessToken,
            },
            rejectUnauthorized: false,
            jar: true
        };
        azureCloudManagementService.http.get(config, processResourceGroupsResponse(d));
    }
    else 
    {
        resourceGroupsToCheck = resourceGroups;
        d.resolve(); 
    }

    return d.promise;
}

function sanitize (output) {
  const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

function extractVMinfo(vm)
{
    if (vm.properties && vm.properties.vmId) {
        var id = sanitize(vm.properties.vmId);
        var vmName = vm.name?vm.name:"N/A";
        var location = vm.location?vm.location:"M/A";

        var size = "N/A";
        if (vm.properties.hardwareProfile && vm.properties.hardwareProfile.vmSize)
            size = vm.properties.hardwareProfile.vmSize

        var osType = "N/A";
        var imagePublisher = "N/A";
        var imageName = "N/A";
        var imageVersion = "N/A";

        if (vm.properties.storageProfile) {
            if (vm.properties.storageProfile.osDisk && vm.properties.storageProfile.osDisk.osType)
                osType = vm.properties.storageProfile.osDisk.osType;
            
            if (vm.properties.storageProfile.imageReference) {
                if (vm.properties.storageProfile.imageReference.publisher)
                    imagePublisher = vm.properties.storageProfile.imageReference.publisher;

                if (vm.properties.storageProfile.imageReference.offer)
                    imageName = vm.properties.storageProfile.imageReference.offer;

                if (vm.properties.storageProfile.imageReference.version)
                    imageVersion = vm.properties.storageProfile.imageReference.version;
            }
        }   

        var resourceGroup = "N/A";
        if (vm.id) {
            const resourceGroupMatch = vm.id.match(/\/resourceGroups\/([^\/]*)\//);
            if (resourceGroupMatch && resourceGroupMatch[1])
                resourceGroup = resourceGroupMatch[1];
        }

        vmTable.insertRecord(id, [
            vmName,
            osType,
            location,
            size,
            imagePublisher,
            imageName,            
            imageVersion,                        
            resourceGroup
        ]);
    }
}

function processVMsResponse(d) 
{
    return function process(error, response, body) {
        checkHTTPError(error, response);

        var bodyAsJSON = JSON.parse(body);
        if (!bodyAsJSON.value)
            D.failure(D.errorType.GENERIC_ERROR);

        bodyAsJSON.value.forEach(extractVMinfo);
        d.resolve();
    }
}



/**
 * Retrieve Azure VMs for a specific resource group
 * @returns A promise that resolves on successful request
 */
function retrieveVMsByResourceGroup(resourceGroup) {
    var d = D.q.defer();
    var config = {
        url: "/subscriptions/" + subscriptionId+"/resourceGroups/"+resourceGroup+"/providers/Microsoft.Compute/virtualMachines?api-version=2021-04-01",
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
 * Retrieve Azure VMs for the configured or all resource groups
 * @returns A promise that resolves on successful login
 */
function retrieveVMs() {
    const vmInfoPromises = []

    resourceGroupsToCheck.forEach(function (resourceGroup) {
        var vmInfoPromise = retrieveVMsByResourceGroup(resourceGroup);
        vmInfoPromises.push(vmInfoPromise);
    });

    return D.q.all(vmInfoPromises)
}

/**
 * @remote_procedure
 * @label Validate Azure connection 
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    login()
        .then(function () {
            D.success();
        })
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

function publishVMTable()
{
    D.success(vmTable);
}

/**
 * @remote_procedure
 * @label Get Azure VMs
 * @documentation This procedure is used to extract Azure VMs.
 */
function get_status() {
    login()
        .then(retrieveResourceGroups)
        .then(retrieveVMs)
        .then(publishVMTable)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
