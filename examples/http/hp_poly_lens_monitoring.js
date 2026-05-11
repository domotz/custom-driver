/**
 * Poly Lens Device Monitoring Script v2.0
 * 
 * DESCRIPTION:
 * This script retrieves detailed information about Poly devices from the Poly Lens cloud platform
 * and integrates it with the Domotz network monitoring system. It provides comprehensive device
 * monitoring capabilities for Poly audio/video conferencing equipment.
 * 
 * DEVICE DISCOVERY:
 * The script can be used to retrieve Poly device details for devices discovered by the Domotz 
 * collector via Layer 2 (MAC address) or Layer 3 (IP address) discovery. Unless cloudControllerDeviceID 
 * is correctly set in the script parameters, Layer 3 discovery is the less efficient way to interact 
 * with Poly Lens as it requires multiple GraphQL API calls.
 * 
 * CLOUDCONTROLLERDEVICEID PARAMETER:
 * This parameter controls how the script identifies and retrieves device information:
 * 
 * 1. Poly Object ID (Most Efficient): 
 *    - Contains the specific Poly Object ID of the device
 *    - This is the most efficient method as the Poly GraphQL API can retrieve the object directly via ID
 *    - Requires only one GraphQL API call
 * 
 * 2. "null" (Automatic Detection):
 *    - Set to "null" (string) when the Poly Object ID is not known
 *    - If MAC address is present (device discovered via Layer 2), the script uses MAC-based search
 *    - If MAC address is not present (device discovered via Layer 3), the script uses IP-based search
 *    - IP-based search is less efficient as it requires two GraphQL API calls:
 *      * First call: Retrieve the complete device list
 *      * Second call: Get specific device details
 *    - Note: MAC address can be used as a searchable attribute in GraphQL API, but IP address cannot
 * 
 * 3. "all" (Show All Devices):
 *    - Set to "all" to display a table showing all Poly devices visible to the provided credentials
 *    - Useful for inventory management and device discovery
 *    - Shows devices accessible via the client_id and client_secret credentials
 * 
 * 4. "error" (Show GraphQL Errors):
 *    - Set to "error" to display detailed GraphQL API errors as variables
 *    - Useful for debugging API permission issues and troubleshooting
 *    - Shows error messages, permissions, codes, and resource information
 * 
 * AUTHENTICATION:
 * - client_id: Poly Lens Client ID credential for OAuth token authentication
 * - client_secret: Poly Lens Client Secret credential for OAuth token authentication
 * - These credentials authenticate to the Poly Lens tenant via OAuth 2.0 token-based authentication
 * 
 * INFORMATION RETRIEVED AND DISPLAYED:
 * The script retrieves and displays the following information from Poly Lens in the Domotz interface:
 * 
 * Device Identity:
 * - Device ID, Name, Display Name, Serial Number
 * - MAC Address, Internal IP Address, External IP Address
 * - Hardware Model, Hardware Family, Hardware Revision
 * - Manufacturer, Product Name
 * 
 * Status Information:
 * - Connection Status (connected/disconnected)
 * - Call Status, Last Detected timestamp
 * - Date Registered, Provisioning State
 * - Software Version, Software Build
 * 
 * Integration Status:
 * - Zoom Room Status, Zoom Device Health
 * - Microsoft Teams Device Health Status
 * - Teams Presence Activity and Availability
 * 
 * Device Capabilities:
 * - Support for Settings, Software Updates, Remote Sessions
 * - Provisioning and Policy Support
 * - Peripheral device information
 * 
 * Management Links:
 * - Direct link to Poly Lens device management interface
 * - Domotz portal links for connected devices
 * 
 * Connection Details:
 * - Device connections and their status
 * - Connected peripheral devices
 * 
 * Location and Tenant:
 * - Room assignment, Geographic location
 * - Tenant information and organization details
 * 
 * The script optimizes API calls based on available device information and provides efficient
 * device monitoring integration between Poly Lens and Domotz platforms.
 */


/**
 * @description Poly Lens Client ID
 * @type SECRET_TEXT 
 */
var client_id = D.getParameter('client_id'); 

/**
 * @description Poly Lens Client Secret
 * @type SECRET_TEXT 
 */
var client_secret = D.getParameter('client_secret');

/**
 * @description Cloud Controller Device ID (optional - if provided, skips device discovery)
 * @type STRING
 */
var cloudControllerDeviceID = D.getParameter('cloudControllerDeviceID');

const polyLensAPI = D.createExternalDevice('login.lens.poly.com');
const polyLensGraphQLAPI = D.createExternalDevice('api.silica-prod01.io.lens.poly.com');

var variables = [];
var accessToken = null;
var apiResponseOutcome = "success"; // Track API response outcomes
var graphqlErrors = []; // Store GraphQL errors for error mode

// Create connections table
var connectionsTable = D.createTable(
    "Device Connections",
    [
        {label: "Name", valueType: D.valueType.STRING},
//        {label: "ID", valueType: D.valueType.STRING},
        {label: "Connected", valueType: D.valueType.BOOLEAN}
    ]
);

// Create device table for showing all devices
var deviceTable = D.createTable(
    "All Devices",
    [
        {label: "Name", valueType: D.valueType.STRING},
        {label: "Display Name", valueType: D.valueType.STRING},
        {label: "Serial Number", valueType: D.valueType.STRING},
        {label: "Connected", valueType: D.valueType.BOOLEAN},
        {label: "Hardware Model", valueType: D.valueType.STRING},
        {label: "Software Version", valueType: D.valueType.STRING},
        {label: "MAC Address", valueType: D.valueType.STRING},
        {label: "Internal IP", valueType: D.valueType.STRING},
        {label: "Poly Link", valueType: D.valueType.STRING}
    ]
);

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    console.log("Starting validation... - execute validate()");
    console.log("Device serial:", D.device.serial());
    
    getAccessToken()
    .then(function(token) {
        console.log("Token obtained successfully");
        
        // Check if cloudControllerDeviceID is "all" - only validate credentials
        if (cloudControllerDeviceID && cloudControllerDeviceID.trim().toLowerCase() === 'all') {
            console.log("CloudControllerDeviceID is 'all' - only validating credentials, skipping device-specific checks");
            D.success();
            return;
        }
        
        // For specific devices, continue with inventory check
        return retrieveInventory();
    })
    .then(function(devices) {
        // Skip device processing if cloudControllerDeviceID is "all" (already handled above)
        if (cloudControllerDeviceID && cloudControllerDeviceID.trim().toLowerCase() === 'all') {
            return;
        }
        
        console.log("Processing inventory response");
        var found = false;
        if (devices && devices.length > 0) {
            // Get device identifiers
            var deviceSerial = D.device.serial();
            var deviceIp = D.device.ip();
            
            // Prepare identifiers for comparison
            var hasSerial = deviceSerial && deviceSerial !== null && deviceSerial !== undefined && deviceSerial.toLowerCase() !== "n/a";
            var hasCloudControllerId = cloudControllerDeviceID && cloudControllerDeviceID.trim() !== '' && cloudControllerDeviceID !== 'null';
            var hasIp = deviceIp && deviceIp !== null && deviceIp !== undefined;
            
            console.log("Validation identifiers - Serial:", hasSerial ? deviceSerial : "N/A", 
                       "CloudControllerDeviceID:", hasCloudControllerId ? cloudControllerDeviceID : "N/A",
                       "IP:", hasIp ? deviceIp : "N/A");
            
            for (var i = 0; i < devices.length; i++) {
                if (devices[i].node) {
                    var node = devices[i].node;
                    
                    // Check cloudControllerDeviceID against node.id
                    if (hasCloudControllerId && node.id && node.id === cloudControllerDeviceID) {
                        console.log("Device found by cloudControllerDeviceID match:", cloudControllerDeviceID);
                        found = true;
                        break;
                    }
                    
                    // Check serial number against node.serialNumber
                    if (hasSerial && node.serialNumber && 
                        node.serialNumber.toLowerCase() === deviceSerial.toLowerCase()) {
                        console.log("Device found by serial number match:", deviceSerial);
                        found = true;
                        break;
                    }
                    
                    // Check device IP against node.internalIp
                    if (hasIp && node.internalIp && node.internalIp === deviceIp) {
                        console.log("Device found by IP address match:", deviceIp);
                        found = true;
                        break;
                    }
                }
            }
        }
        if (found) {
            console.log("Device found in inventory");
            D.success();
        } else {
            console.log("Device not found in inventory");
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
    })
    .catch(function(error) {
        console.error("Validation error:", error);
        D.failure(D.errorType.GENERIC_ERROR);
    });
} 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device variables data
*/
function get_status(){
    console.log("Starting get_status... - execute get_status()");
    
    // Reset API response outcome and errors for this execution
    apiResponseOutcome = "success";
    graphqlErrors = [];
    
    getAccessToken()
    .then(function(token) {
        console.log("Token obtained successfully");
        // Check if cloudControllerDeviceID is "all" to show all devices
        if (cloudControllerDeviceID && cloudControllerDeviceID.trim().toLowerCase() === 'all') {
            console.log("Retrieving all devices in inventory for display");
            // Retrieve all devices and display them in a table
            return retrieveInventory()
                .then(processAllDevicesForTable);
        }
        // Check if cloudControllerDeviceID is "error" to show error details
        else if (cloudControllerDeviceID && cloudControllerDeviceID.trim().toLowerCase() === 'error') {
            console.log("Error mode: retrieving inventory to capture GraphQL errors");
            // Retrieve inventory to capture errors, then return error variables
            return retrieveInventory()
                .then(function() {
                    // Even if successful, we want to show any errors that occurred
                    var errorVars = createErrorVariables(graphqlErrors);
                    if (errorVars.length > 0) {
                        D.success(errorVars);
                    } else {
                        // No errors found, create a message indicating this
                        var noErrorsVar = D.device.createVariable(
                            "no-errors", 
                            "No errors found", 
                            "No GraphQL errors were encountered during the API call", 
                            null, 
                            D.valueType.STRING
                        );
                        D.success([noErrorsVar]);
                    }
                })
                .catch(function(errors) {
                    // If the call failed, create error variables from the stored errors
                    var errorVars = createErrorVariables(graphqlErrors);
                    if (errorVars.length > 0) {
                        D.success(errorVars);
                    } else {
                        // Fallback if no errors were stored
                        var fallbackError = D.device.createVariable(
                            "fallback-error", 
                            "Api call failed", 
                            "The API call failed but no specific error details were captured", 
                            null, 
                            D.valueType.STRING
                        );
                        D.success([fallbackError]);
                    }
                });
        }
        // Check if cloudControllerDeviceID is provided and not null/empty/string "null"
        else if (cloudControllerDeviceID && cloudControllerDeviceID.trim() !== '' && cloudControllerDeviceID !== 'null') {
            console.log("Using provided cloudControllerDeviceID:", cloudControllerDeviceID);
            // Skip inventory retrieval and device finding, use provided ID directly
            return retrieveDeviceDetails(cloudControllerDeviceID);
        } else {
            console.log("No cloudControllerDeviceID provided, checking for MAC address");
            var deviceMacAddress = D.device.macAddress();
            if (deviceMacAddress && deviceMacAddress !== null && deviceMacAddress !== undefined) {
                console.log("Using optimized MAC address discovery flow with MAC:", deviceMacAddress);
                // Use optimized MAC address flow: get inventory by MAC directly (returns only one device with full details)
                return retrieveInventoryByMacAddress();
            } else {
                console.log("No MAC address available, using general device discovery flow");
                // Use existing flow: get inventory, find device, then get details
                return retrieveInventory()
                    .then(findDevice)
                    .then(retrieveDeviceDetails);
            }
        }
    })
    .then(function() {
        var vars = publishVariables();
        // Show deviceTable if cloudControllerDeviceID is "all", otherwise show connectionsTable
        if (cloudControllerDeviceID && cloudControllerDeviceID.trim().toLowerCase() === 'all') {
            D.success(vars, deviceTable);
        } else {
            D.success(vars, connectionsTable);
        }
    })
    .catch(function (error) {
        console.error("Get status error:", error);
        D.failure(D.errorType.GENERIC_ERROR);
    });
}

function getAccessToken() {
    console.log("Getting access token... - execute getAccessToken()");
    const d = D.q.defer();

    const config = {
        url: "/oauth/token",
        protocol: "https",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            grant_type: "client_credentials",
            client_id: client_id,
            client_secret: client_secret
        })
    };

    polyLensAPI.http.post(config, function (err, response, body) {
        console.log("Token response received");
        if (err) {
            console.error("Token error:", err);
            d.reject(err);
            return;
        }
        try {
            const bodyAsJSON = JSON.parse(body);
            console.log("Token parsed successfully");
            accessToken = bodyAsJSON.access_token;
            d.resolve(accessToken);
        } catch (e) {
            console.error("Token parsing error:", e);
            console.log("Raw token response:", body);
            d.reject(e);
        }
    });

    return d.promise;
}

function retrieveInventory() {
    console.log("Retrieving inventory... - execute retrieveInventory()");
    const d = D.q.defer();

    const query = {
        query: 'query allDevices($params: DeviceFindArgs) {' +
            'deviceSearch(params: $params) {' +
            '    edges {' +
            '        node {' +
            '            name' +
            '            displayName' +
            '            serialNumber' +
            '            id' +
            '            connected' +
            '            hardwareModel' +
            '            softwareVersion' +
            '            macAddress' +
            '            internalIp' +
            '            tenantId' +
            '        }' +
            '    }' +
            '}' +
        '}',
        variables: {
            params: {
                pageSize: 100
            }
        }
    };

    const config = {
        url: "/graphql",
        protocol: "https",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + accessToken
        },
        body: JSON.stringify(query)
    };

    console.log("Sending GraphQL query...");
    polyLensGraphQLAPI.http.post(config, function (err, response, body) {
        if (err) {
            console.error("GraphQL error:", err);
            d.reject(err);
            return;
        }
        console.log("GraphQL response received");
        try {
            const bodyAsJSON = JSON.parse(body);
            console.log("GraphQL response parsed");
            if (bodyAsJSON.errors) {
                console.error("GraphQL errors:", bodyAsJSON.errors);
                apiResponseOutcome = "error";
                // Store errors for potential error mode processing
                graphqlErrors = graphqlErrors.concat(bodyAsJSON.errors);
                // Continue execution even with errors if we have data
                if (bodyAsJSON.data && bodyAsJSON.data.deviceSearch && bodyAsJSON.data.deviceSearch.edges) {
                    console.log("Found", bodyAsJSON.data.deviceSearch.edges.length, "devices despite errors");
                    d.resolve(bodyAsJSON.data.deviceSearch.edges);
                    return;
                }
                d.reject(bodyAsJSON.errors);
                return;
            }
            if (bodyAsJSON.data && bodyAsJSON.data.deviceSearch && bodyAsJSON.data.deviceSearch.edges) {
                console.log("Found", bodyAsJSON.data.deviceSearch.edges.length, "devices");
                d.resolve(bodyAsJSON.data.deviceSearch.edges);
            } else {
                console.error("Unexpected response structure:", bodyAsJSON);
                apiResponseOutcome = "error";
                d.reject("Invalid response structure");
            }
        } catch (e) {
            console.error("GraphQL response parsing error:", e);
            console.log("Raw GraphQL response:", body);
            apiResponseOutcome = "error";
            d.reject(e);
        }
    });

    return d.promise;
}

function retrieveInventoryByMacAddress() {
    console.log("Retrieving inventory by MAC address... - execute retrieveInventoryByMacAddress()");
    const d = D.q.defer();

    var deviceMacAddress = D.device.macAddress().toLowerCase();
    console.log("Device MAC address:", deviceMacAddress);

    const query = {
        query: 'query allDevices($params: DeviceFindArgs) {' +
            'deviceSearch(params: $params) {' +
            '    edges {' +
            '        node {' +
            '    id room {name floor capacity type size} ' +
            '    name' +
            '    displayName' +
            '    serialNumber' +
            '    connected' +
            '    connections {' +
            '        name' +
            '        id' +
            '        connected' +
            '    }' +
            '    hardwareModel' +
            '    hardwareFamily' +
            '    hardwareRevision' +
            '    softwareVersion' +
            '    softwareBuild' +
            '    macAddress' +
            '    externalIp' +
            '    internalIp' +
            '    lastDetected' +
            '    dateRegistered' +
            '    shipmentDate' +
            '    tenantId' +
            '    productId' +
            '    organization' +
            '    manufacturer' +
            '    callStatus' +
            '    supportsSettings' +
            '    supportsSoftwareUpdate' +
            '    supportsRemoteSessions' +
            '    provisioningEnabled' +
            '    supportsProvisioning' +
            '    supportsPolicies' +
            '    hasPeripherals' +
            '    allPeripheralsLinked' +
            '    inVirtualDevice' +
            '    lastConfigRequestDate' +
            '    activeApplicationName' +
            '    activeApplicationVersion' +
            '    provisioningState' +
            '    usbVendorId' +
            '    usbProductId' +
            '    proxyAgent' +
            '    proxyAgentId' +
            '    proxyAgentVersion' +
            '    locationMode' +
            '    etag' +
            '    zoomDeviceId' +
            '    zoomDeviceStatus' +
            '    zoomRoomId' +
            '    zoomRoomLink' +
            '    zoomRoomName' +
            '    zoomRoomStatus' +
            '    teamsDeviceId' +
            '    teamsDeviceHealthStatus' +
            '    teamsRoomId' +
            '    teamsRoomLink' +
            '    teamsRoomName' +
            '    teamsUserId' +
            '    teamsPresenceActivity' +
            '    teamsPresenceAvailability' +
            '    product {' +
            '        name' +
            '        id' +
            '    }' +
            '    model {' +
            '        name' +
            '        id' +
            '    }' +
            '    location {' +
            '        geohash' +
            '        coordinate {' +
            '            latitude' +
            '            longitude' +
            '        }' +
            '    }' +
            '    tenant {' +
            '        id' +
            '        name' +
            '    }' +
            '}' +
            '    }' +
            '}' +
        '}',
        variables: {
            params: {
                filter: {
                    field: "macAddress",
                    contains: deviceMacAddress
                },
                pageSize: 1
            }
        }
    };

    const config = {
        url: "/graphql",
        protocol: "https",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + accessToken
        },
        body: JSON.stringify(query)
    };

    console.log("Sending GraphQL query for MAC address...");
    polyLensGraphQLAPI.http.post(config, function (err, response, body) {
        if (err) {
            console.error("GraphQL error:", err);
            d.reject(err);
            return;
        }
        console.log("GraphQL response received");
        try {
            const bodyAsJSON = JSON.parse(body);
            console.log("GraphQL response parsed");
            if (bodyAsJSON.errors) {
                console.error("GraphQL errors:", bodyAsJSON.errors);
                apiResponseOutcome = "error";
                // Store errors for potential error mode processing
                graphqlErrors = graphqlErrors.concat(bodyAsJSON.errors);
                // Continue execution even with errors if we have data
                if (bodyAsJSON.data && bodyAsJSON.data.deviceSearch && bodyAsJSON.data.deviceSearch.edges) {
                    console.log("Found", bodyAsJSON.data.deviceSearch.edges.length, "devices by MAC address despite errors");
                    
                    if (bodyAsJSON.data.deviceSearch.edges.length === 0) {
                        console.error("No device found with the specified MAC address");
                        d.reject("No device found with MAC address: " + deviceMacAddress);
                        return;
                    }
                    
                    // Extract the device from the edges array (only one device expected due to pageSize: 1)
                    var device = bodyAsJSON.data.deviceSearch.edges[0].node;
                    console.log("Processing device data directly from MAC address lookup");
                    
                    // Process the device data directly (same as retrieveDeviceDetails does)
                    createDeviceInfoVariables(device);
                    d.resolve();
                    return;
                }
                d.reject(bodyAsJSON.errors);
                return;
            }
            if (bodyAsJSON.data && bodyAsJSON.data.deviceSearch && bodyAsJSON.data.deviceSearch.edges) {
                console.log("Found", bodyAsJSON.data.deviceSearch.edges.length, "devices by MAC address");
                
                if (bodyAsJSON.data.deviceSearch.edges.length === 0) {
                    console.error("No device found with the specified MAC address");
                    d.reject("No device found with MAC address: " + deviceMacAddress);
                    return;
                }
                
                // Extract the device from the edges array (only one device expected due to pageSize: 1)
                var device = bodyAsJSON.data.deviceSearch.edges[0].node;
                console.log("Processing device data directly from MAC address lookup");
                
                // Process the device data directly (same as retrieveDeviceDetails does)
                createDeviceInfoVariables(device);
                d.resolve();
            } else {
                console.error("Unexpected response structure:", bodyAsJSON);
                apiResponseOutcome = "error";
                d.reject("Invalid response structure");
            }
        } catch (e) {
            console.error("GraphQL response parsing error:", e);
            console.log("Raw GraphQL response:", body);
            apiResponseOutcome = "error";
            d.reject(e);
        }
    });

    return d.promise;
}

function findDevice(devices) {
    console.log("Finding device in inventory... - execute findDevice()");
    const d = D.q.defer();
    
    if (!Array.isArray(devices)) {
        console.error("Invalid devices data");
        d.reject("Invalid devices data");
        return d.promise;
    }

    var device = null;
    var deviceIp = D.device.ip();
    
    console.log("Looking for device with IP:", deviceIp);
    
    if (!deviceIp) {
        console.error("Device IP is not available");
        d.reject("Device IP address is not available for device matching");
        return d.promise;
    }
    
    // IP address matching only
    for (var i = 0; i < devices.length; i++) {
        if (devices[i].node && 
            devices[i].node.internalIp && 
            devices[i].node.internalIp === deviceIp) {
            device = devices[i].node;
            console.log("Device found by IP:", device.id);
            break;
        }
    }

    if (!device) {
        console.error("Device not found in inventory");
        d.reject("IP address " + deviceIp + " not found in Poly Lens inventory");
    } else {
        d.resolve(device.id);
    }

    return d.promise;
}

function retrieveDeviceDetails(deviceId) {

    console.log("Execute retrieveDeviceDetails()");

    const d = D.q.defer();

    const query = {
        query: 'query getDevice($id: String!) {' +
            'device(id: $id) {' +
            '    id room {name floor capacity type size} ' +
            '    name' +
            '    displayName' +
            '    serialNumber' +
            '    connected' +
            '    connections {' +
            '        name' +
            '        id' +
            '        connected' +
            '    }' +
            '    hardwareModel' +
            '    hardwareFamily' +
            '    hardwareRevision' +
            '    softwareVersion' +
            '    softwareBuild' +
            '    macAddress' +
            '    externalIp' +
            '    internalIp' +
            '    lastDetected' +
            '    dateRegistered' +
            '    shipmentDate' +
            '    tenantId' +
            '    productId' +
            '    organization' +
            '    manufacturer' +
            '    callStatus' +
            '    supportsSettings' +
            '    supportsSoftwareUpdate' +
            '    supportsRemoteSessions' +
            '    provisioningEnabled' +
            '    supportsProvisioning' +
            '    supportsPolicies' +
            '    hasPeripherals' +
            '    allPeripheralsLinked' +
            '    inVirtualDevice' +
            '    lastConfigRequestDate' +
            '    activeApplicationName' +
            '    activeApplicationVersion' +
            '    provisioningState' +
            '    usbVendorId' +
            '    usbProductId' +
            '    proxyAgent' +
            '    proxyAgentId' +
            '    proxyAgentVersion' +
            '    locationMode' +
            '    etag' +
            '    zoomDeviceId' +
            '    zoomDeviceStatus' +
            '    zoomRoomId' +
            '    zoomRoomLink' +
            '    zoomRoomName' +
            '    zoomRoomStatus' +
            '    teamsDeviceId' +
            '    teamsDeviceHealthStatus' +
            '    teamsRoomId' +
            '    teamsRoomLink' +
            '    teamsRoomName' +
            '    teamsUserId' +
            '    teamsPresenceActivity' +
            '    teamsPresenceAvailability' +
            '    product {' +
            '        name' +
            '        id' +
            '    }' +
            '    model {' +
            '        name' +
            '        id' +
            '    }' +
            '    location {' +
            '        geohash' +
            '        coordinate {' +
            '            latitude' +
            '            longitude' +
            '        }' +
            '    }' +
            '    tenant {' +
            '        id' +
            '        name' +
            '    }' +
            '}' +
        '}',
        variables: {
            id: deviceId
        }
    };

    const config = {
        url: "/graphql",
        protocol: "https",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + accessToken
        },
        body: JSON.stringify(query)
    };

    polyLensGraphQLAPI.http.post(config, function (err, response, body) {
        if (err) {
            console.error("GraphQL error:", err);
            apiResponseOutcome = "error";
            d.reject(err);
            return;
        }
        
        try {
            const bodyAsJSON = JSON.parse(body);
            console.log("GraphQL response parsed");
            
            if (bodyAsJSON.errors) {
                console.error("GraphQL errors:", bodyAsJSON.errors);
                apiResponseOutcome = "error";
                // Store errors for potential error mode processing
                graphqlErrors = graphqlErrors.concat(bodyAsJSON.errors);
                // Continue execution even with errors if we have data
                if (bodyAsJSON.data && bodyAsJSON.data.device) {
                    console.log("Found device data despite errors");
                    createDeviceInfoVariables(bodyAsJSON.data.device);
                    d.resolve();
                    return;
                }
                d.reject(bodyAsJSON.errors);
                return;
            }
            
            if (bodyAsJSON.data && bodyAsJSON.data.device) {
                console.log("Found device data");
                createDeviceInfoVariables(bodyAsJSON.data.device);
                d.resolve();
            } else {
                console.error("Unexpected response structure:", bodyAsJSON);
                apiResponseOutcome = "error";
                d.reject("Invalid response structure");
            }
        } catch (e) {
            console.error("GraphQL response parsing error:", e);
            console.log("Raw GraphQL response:", body);
            apiResponseOutcome = "error";
            d.reject(e);
        }
    });

    return d.promise;
}

function publishVariables() {
    console.log("Publishing variables:", variables.length, "variables found - execute publishVariables()");
    if (!variables || !variables.length) {
        console.warn("No variables to publish");
    }
    return variables;
}

function createErrorVariables(errors) {
    console.log("Creating error variables from GraphQL errors... - execute createErrorVariables()");
    var errorVariables = [];
    
    if (!Array.isArray(errors)) {
        console.warn("Errors is not an array:", errors);
        return errorVariables;
    }
    
    errors.forEach(function(error, index) {
        var errorId = String(index + 1); // Incremental numeric ID starting from 1
        
        // Add message variable
        if (error.message) {
            errorVariables.push(D.device.createVariable(
                "error-" + errorId + "-message", 
                "Error " + errorId + " - message", 
                error.message, 
                null, 
                D.valueType.STRING
            ));
        }
        
        // Add permissions variable if available
        if (error.extensions && error.extensions.permissions && Array.isArray(error.extensions.permissions)) {
            errorVariables.push(D.device.createVariable(
                "error-" + errorId + "-permissions", 
                "Error " + errorId + " - permissions", 
                error.extensions.permissions.join(", "), 
                null, 
                D.valueType.STRING
            ));
        }
        
        // Add code variable if available
        if (error.extensions && error.extensions.code) {
            errorVariables.push(D.device.createVariable(
                "error-" + errorId + "-code", 
                "Error " + errorId + " - code", 
                error.extensions.code, 
                null, 
                D.valueType.STRING
            ));
        }
        
        // Add resource information if available
        if (error.extensions && error.extensions.resource) {
            if (error.extensions.resource.id) {
                errorVariables.push(D.device.createVariable(
                    "error-" + errorId + "-resource-id", 
                    "Error " + errorId + " - resource id", 
                    error.extensions.resource.id, 
                    null, 
                    D.valueType.STRING
                ));
            }
            if (error.extensions.resource.type) {
                errorVariables.push(D.device.createVariable(
                    "error-" + errorId + "-resource-type", 
                    "Error " + errorId + " - resource type", 
                    error.extensions.resource.type, 
                    null, 
                    D.valueType.STRING
                ));
            }
        }
    });
    
    console.log("Created", errorVariables.length, "error variables");
    return errorVariables;
}

/**
 * Polishes strings by replacing 'wpp' (case insensitive) with '-'
 * @param {string} inputString - The string to polish
 * @returns {string} - The polished string
 */
function polishStrings(inputString) {
    if (typeof inputString !== 'string') {
        return inputString;
    }
    return inputString.replace(/wpp/gi, '-');
}

function processAllDevicesForTable(devices) {
    console.log("Processing all devices for table... - execute processAllDevicesForTable()");
    const d = D.q.defer();
    
    if (!Array.isArray(devices)) {
        console.error("Invalid devices data for table processing");
        d.reject("Invalid devices data for table processing");
        return d.promise;
    }
    
    console.log("Adding", devices.length, "devices to device table");
    
    devices.forEach(function(deviceEdge, index) {
        if (deviceEdge.node) {
            var device = deviceEdge.node;
            var recordId = String(device.id || index);
            
            // Calculate Poly Lens URL
            var polyLensUrl = "";
            if (device.macAddress && device.tenantId) {
                var macAddressNoColon = device.macAddress.replace(/:/g, '');
                polyLensUrl = "https://lens.poly.com/manage/inventory/details/" + macAddressNoColon + "?tenantid=" + device.tenantId;
            }
            
            // Add device to table using addMetrics
            deviceTable.addMetrics(recordId, [
                {value: device.name || '', metadata: {}},
                {value: device.displayName || '', metadata: {}},
                {value: device.serialNumber || '', metadata: {}},
                {value: device.connected !== undefined ? device.connected : false, metadata: {}},
                {value: device.hardwareModel || '', metadata: {}},
                {value: device.softwareVersion || '', metadata: {}},
                {value: device.macAddress || '', metadata: {}},
                {value: device.internalIp || '', metadata: {}},
                {value: polyLensUrl, metadata: polyLensUrl ? {'url': polyLensUrl} : {}}
            ]);
        }
    });
    
    // Add API response outcomes variable even when showing all devices
    variables.push(D.device.createVariable("api-response-outcomes", "Api response outcomes", apiResponseOutcome, null, D.valueType.STRING));
    
    d.resolve();
    return d.promise;
}

function processConnections(deviceData) {
    console.log("Processing connections... - execute processConnections()");
    // Process connections array if present
    if (deviceData.connections && Array.isArray(deviceData.connections)) {
        deviceData.connections.forEach(function(connection) {
            var recordId = String(connection.id || '');

            connectionsTable.addMetrics(recordId,
                [{value: connection.name || ''},{value: connection.connected !== undefined ? connection.connected : false}]
                    
            );
        });
    }
}

function createDeviceInfoVariables(deviceData) {
    console.log("Creating device info variables... - execute createDeviceInfoVariables()");
    // Process connections data
    processConnections(deviceData);

    if (deviceData.id !== undefined)
        variables.push(D.device.createVariable("id", "Id", polishStrings(deviceData.id), null, D.valueType.STRING));

    if (deviceData.displayName !== undefined)
        variables.push(D.device.createVariable("displayName", "Display name", polishStrings(deviceData.displayName), null, D.valueType.STRING));

    if (deviceData.room !== undefined && deviceData.room.name !== undefined)
        variables.push(D.device.createVariable("room-name", "Room name", polishStrings(deviceData.room.name), null, D.valueType.STRING));
    
    if (deviceData.room !== undefined && deviceData.room.floor !== undefined)
        variables.push(D.device.createVariable("floor", "Floor", polishStrings(deviceData.room.floor), null, D.valueType.STRING));
    
    if (deviceData.room !== undefined && deviceData.room.capacity !== undefined)
        variables.push(D.device.createVariable("room-capacity", "Room capacity", polishStrings(deviceData.room.capacity), null, D.valueType.STRING));
    
    if (deviceData.room !== undefined && deviceData.room.type !== undefined)
        variables.push(D.device.createVariable("room-type", "Room type", polishStrings(deviceData.room.type), null, D.valueType.STRING));
    
    if (deviceData.room !== undefined && deviceData.room.size !== undefined)
        variables.push(D.device.createVariable("room-size", "Room size", polishStrings(deviceData.room.size), null, D.valueType.STRING));
 
    if (deviceData.name !== undefined)
        variables.push(D.device.createVariable("name", "Name", polishStrings(deviceData.name), null, D.valueType.STRING));

    if (deviceData.serialNumber !== undefined) 
        variables.push(D.device.createVariable("serial", "Serial", polishStrings(deviceData.serialNumber), null, D.valueType.STRING));
    
    if (deviceData.hardwareModel !== undefined) 
        variables.push(D.device.createVariable("model", "Model", polishStrings(deviceData.hardwareModel), null, D.valueType.STRING));
    
    if (deviceData.connected !== undefined) 
        variables.push(D.device.createVariable("connected", "Connected", deviceData.connected, null, D.valueType.BOOLEAN));
    
    if (deviceData.softwareVersion !== undefined) 
        variables.push(D.device.createVariable("software-version", "Software version", polishStrings(deviceData.softwareVersion), null, D.valueType.STRING));
    
    if (deviceData.softwareBuild !== undefined) 
        variables.push(D.device.createVariable("software-build", "Software build", polishStrings(deviceData.softwareBuild), null, D.valueType.STRING));
    
    if (deviceData.hardwareFamily !== undefined) 
        variables.push(D.device.createVariable("hardware-family", "Hardware family", polishStrings(deviceData.hardwareFamily), null, D.valueType.STRING));
    
    if (deviceData.hardwareRevision !== undefined) 
        variables.push(D.device.createVariable("hardware-revision", "Hardware revision", polishStrings(deviceData.hardwareRevision), null, D.valueType.STRING));
    
    if (deviceData.macAddress !== undefined) 
        variables.push(D.device.createVariable("mac-address", "Mac address", polishStrings(deviceData.macAddress), null, D.valueType.STRING));
    
    if (deviceData.internalIp !== undefined) 
        variables.push(D.device.createVariable("internal-ip", "Internal ip", polishStrings(deviceData.internalIp), null, D.valueType.STRING));
    
    if (deviceData.externalIp !== undefined) 
        variables.push(D.device.createVariable("external-ip", "External ip", polishStrings(deviceData.externalIp), null, D.valueType.STRING));
    
    if (deviceData.callStatus !== undefined) 
        variables.push(D.device.createVariable("call-status", "Call status", polishStrings(deviceData.callStatus), null, D.valueType.STRING));
    
    if (deviceData.lastDetected !== undefined) 
        variables.push(D.device.createVariable("last-detected", "Last detected", polishStrings(deviceData.lastDetected), null, D.valueType.STRING));
    
    if (deviceData.dateRegistered !== undefined) 
        variables.push(D.device.createVariable("date-registered", "Date registered", polishStrings(deviceData.dateRegistered), null, D.valueType.STRING));
    
    if (deviceData.manufacturer !== undefined)
        variables.push(D.device.createVariable("manufacturer", "Manufacturer", polishStrings(deviceData.manufacturer), null, D.valueType.STRING));

    if (deviceData.provisioningState !== undefined)
        variables.push(D.device.createVariable("provisioning-state", "Provisioning state", polishStrings(deviceData.provisioningState), null, D.valueType.STRING));

    if (deviceData.zoomRoomStatus !== undefined)
        variables.push(D.device.createVariable("zoom-room-status", "Zoom room status", polishStrings(deviceData.zoomRoomStatus), null, D.valueType.STRING));

    if (deviceData.teamsDeviceHealthStatus !== undefined)
        variables.push(D.device.createVariable("teams-health-status", "Teams health status", polishStrings(deviceData.teamsDeviceHealthStatus), null, D.valueType.STRING));

    if (deviceData.product && deviceData.product.name !== undefined)
        variables.push(D.device.createVariable("product-name", "Product name", polishStrings(deviceData.product.name), null, D.valueType.STRING));

    if (deviceData.tenant && deviceData.tenant.name !== undefined)
        variables.push(D.device.createVariable("tenant-name", "Tenant name", polishStrings(deviceData.tenant.name), null, D.valueType.STRING));

    // Create Poly Lens URL for device management
    if (deviceData.macAddress !== undefined && deviceData.tenantId !== undefined) {
        var macAddressNoColon = deviceData.macAddress.replace(/:/g, '');
        var polyLensUrl = "https://lens.poly.com/manage/inventory/details/" + macAddressNoColon + "?tenantid=" + deviceData.tenantId;
        //variables.push(D.device.createVariable("poly-lens-url", "Poly Lens URL", polyLensUrl, null, D.valueType.STRING));

        variables.push(D.createMetric({
            uid: 'poly-lens-url-link',
            name: 'Poly lens url link',
            value: polyLensUrl,
            metadata: {'url': polyLensUrl},
            valueType: D.valueType.NUMBER,
            unit: "%"}));
    }
    
    // Add API response outcomes variable
    variables.push(D.device.createVariable("api-response-outcomes", "Api response outcomes", apiResponseOutcome, null, D.valueType.STRING));
}

function checkHttpError(err, response, body) {
    console.log("Checking HTTP error... - execute checkHttpError()");
    if (err) {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
    if (response.statusCode === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
    if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    }
    if (response.statusCode !== 200) {
        console.error(body);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
* @remote_procedure
* @label Reboot
* @documentation Reboot
*/
function custom_1(){
    console.log("Starting device reboot... - execute custom_4()");
    
    var deviceId = null;
    
    getAccessToken()
    .then(function(token) {
        console.log("Token obtained successfully for reboot");
        
        // Check if cloudControllerDeviceID is provided and valid (not null, not "error", not "all")
        if (cloudControllerDeviceID && 
            cloudControllerDeviceID.trim() !== '' && 
            cloudControllerDeviceID.trim().toLowerCase() !== 'null' &&
            cloudControllerDeviceID.trim().toLowerCase() !== 'error' &&
            cloudControllerDeviceID.trim().toLowerCase() !== 'all') {
            console.log("Using provided cloudControllerDeviceID for reboot:", cloudControllerDeviceID);
            // Use provided ID directly
            return D.q.resolve(cloudControllerDeviceID);
        } else {
            console.log("No valid cloudControllerDeviceID provided, retrieving device ID");
            var deviceMacAddress = D.device.macAddress();
            if (deviceMacAddress && deviceMacAddress !== null && deviceMacAddress !== undefined) {
                console.log("Using MAC address to retrieve device ID for reboot");
                // Use MAC address flow - need to extract device ID from the response
                return retrieveInventory()
                    .then(function(devices) {
                        if (devices && devices.length > 0) {
                            var macAddress = D.device.macAddress().toLowerCase();
                            for (var i = 0; i < devices.length; i++) {
                                if (devices[i].node && devices[i].node.macAddress && 
                                    devices[i].node.macAddress.toLowerCase() === macAddress) {
                                    console.log("Found device ID by MAC:", devices[i].node.id);
                                    return devices[i].node.id;
                                }
                            }
                        }
                        throw new Error("Device not found by MAC address");
                    });
            } else {
                console.log("No MAC address available, using IP-based discovery for reboot");
                // Use IP-based flow
                return retrieveInventory()
                    .then(findDevice);
            }
        }
    })
    .then(function(retrievedDeviceId) {
        deviceId = retrievedDeviceId;
        console.log("Device ID for reboot:", deviceId);
        
        // Call the reboot API
        return rebootDevice(deviceId);
    })
    .then(function(result) {
        console.log("Reboot command executed successfully");
        if (result.success) {
            D.success();
        } else {
            console.error("Reboot failed:", result.error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    })
    .catch(function(error) {
        console.error("Reboot error:", error);
        D.failure(D.errorType.GENERIC_ERROR);
    });
}

function rebootDevice(deviceId) {
    console.log("Executing reboot for device:", deviceId);
    const d = D.q.defer();
    
    const mutation = {
        query: 'mutation reboot($deviceId: String!, $includeLinkedDevices: Boolean) { ' +
            'rebootDevice(deviceId: $deviceId, includeLinkedDevices: $includeLinkedDevices) { ' +
            '    error ' +
            '    success ' +
            '} ' +
        '}',
        variables: {
            deviceId: deviceId,
            includeLinkedDevices: true
        }
    };
    
    const config = {
        url: "/graphql",
        protocol: "https",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + accessToken
        },
        body: JSON.stringify(mutation)
    };
    
    polyLensGraphQLAPI.http.post(config, function (err, response, body) {
        if (err) {
            console.error("Reboot GraphQL error:", err);
            d.reject(err);
            return;
        }
        
        try {
            const bodyAsJSON = JSON.parse(body);
            console.log("Reboot GraphQL response parsed");
            
            if (bodyAsJSON.errors) {
                console.error("Reboot GraphQL errors:", bodyAsJSON.errors);
                d.reject(bodyAsJSON.errors);
                return;
            }
            
            if (bodyAsJSON.data && bodyAsJSON.data.rebootDevice) {
                console.log("Reboot response:", bodyAsJSON.data.rebootDevice);
                d.resolve(bodyAsJSON.data.rebootDevice);
            } else {
                console.error("Unexpected reboot response structure:", bodyAsJSON);
                d.reject("Invalid reboot response structure");
            }
        } catch (e) {
            console.error("Reboot response parsing error:", e);
            console.log("Raw reboot response:", body);
            d.reject(e);
        }
    });
    
    return d.promise;
}
