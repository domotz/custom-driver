/**
 * Domotz Custom Driver
 * Name: Logitech Integration
 * Description: Monitors Logitech CollabOS-based video conferencing devices (e.g. Rally Bar,
 * Rally Board) via the device's local REST API.
 *
 * Communication protocol is HTTPS with token-based authentication (Bearer auth_token obtained
 * via POST /api/v1/signin). Device credentials (username and password) are configured in Domotz
 * and used to obtain a fresh auth token before each data retrieval cycle.
 *
 * Creates Custom Driver Variables with:
 *   - Device configuration: CollabOS version, device configuration, MAC addresses (Ethernet/WiFi),
 *     hardware version, model name, serial number, system/device name, service provider.
 *   - Device insights: device state, microphone state, speaker state, speaker volume/max volume.
 *   - Room insights (CollabOS 1.15+ only): room sensor/occupancy data, dynamically discovered
 *     from the API response. A placeholder variable is published on older CollabOS versions
 *     where this endpoint is not available.
 *   - Peripherals: all connected peripherals (cameras, speakers, etc.) with their reported
 *     properties, dynamically discovered from the API response.
 *
 **/

// Global variable to store auth token
var authToken = null;

// Array to store device variables
var variables = [];

/**
 * Logs in to the Logitech device using JSON authentication.
 * @returns A promise that resolves on successful login with auth token.
 */
function login() {
    var d = D.q.defer();
    var loginData = {
        username: D.device.username(),
        password: D.device.password()
    };
    
    var config = {
        url: "/api/v1/signin",
        protocol: "https",
        port: 443,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(loginData),
        rejectUnauthorized: false,
        jar: true
    };
    
    D.device.http.post(config, function(error, response, body) {
        if (error) {
            console.error("Login error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("Login failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        try {
            var responseData = JSON.parse(body);
            if (responseData.code === 200 && responseData.result && responseData.result.auth_token) {
                authToken = responseData.result.auth_token;
                console.info("Login successful. Auth token:", authToken);
                d.resolve(authToken);
            } else {
                console.error("Invalid login response:", body);
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
        } catch (parseError) {
            console.error("Failed to parse login response:", parseError);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    });
    
    return d.promise;
}

/**
 * Retrieves device configuration from the Logitech device.
 * @returns A promise that resolves with the device configuration data.
 */
function getDeviceConfig() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for device config request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/api/v1/device",
        protocol: "https",
        port: 443,
        headers: {
            "accept-language": "en-US,en",
            "Content-Type": "application/json",
            "Authorization": "Bearer " + authToken
        },
        rejectUnauthorized: false,
        jar: true
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("Device config request error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for device config request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("Device config request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        console.info("Device config retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

/**
 * Retrieves device insights data from the Logitech device.
 * @returns A promise that resolves with the device insights data.
 */
function getDeviceInsights() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for device insights request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/api/v1/insights/device",
        protocol: "https",
        port: 443,
        headers: {
            "accept-language": "en-US,en",
            "Content-Type": "application/json",
            "Authorization": "Bearer " + authToken
        },
        rejectUnauthorized: false,
        jar: true
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("device insights request error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for device insights request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("device insights request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        console.info("device insights data retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

/**
 * Retrieves room insights data from the Logitech device.
 * @returns A promise that resolves with the room insights data.
 */
function getRoomInsights() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for room insights request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/api/v1/insights/room",
        protocol: "https",
        port: 443,
        headers: {
            "accept-language": "en-US,en",
            "Content-Type": "application/json",
            "Authorization": "Bearer " + authToken
        },
        rejectUnauthorized: false,
        jar: true
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("room insights request error:", error);
            d.resolve(null); // Return null instead of failing for version compatibility
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for room insights request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("room insights request failed with status code:", response.statusCode);
            d.resolve(null); // Return null instead of failing for version compatibility
            return;
        }
        
        console.info("room insights data retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

/**
 * Retrieves peripherals data from the Logitech device.
 * @returns A promise that resolves with the peripherals data.
 */
function getPeripheralsData() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for peripherals request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/api/v1/peripherals",
        protocol: "https",
        port: 443,
        headers: {
            "accept-language": "en-US,en",
            "Content-Type": "application/json",
            "Authorization": "Bearer " + authToken
        },
        rejectUnauthorized: false,
        jar: true
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("peripherals request error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for peripherals request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("peripherals request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        console.info("peripherals data retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * Creates device information variables based on the device configuration data.
 * @param {Object} deviceData - The device configuration data from the API response.
 */
function createDeviceInfoVariables(deviceData) {
    if (deviceData.collabOSVersion !== undefined) 
        variables.push(D.device.createVariable("collab-os-version", "CollabOS Version", deviceData.collabOSVersion, null, D.valueType.STRING));
    
    if (deviceData.deviceConfiguration !== undefined) 
        variables.push(D.device.createVariable("device-configuration", "Device Configuration", deviceData.deviceConfiguration, null, D.valueType.STRING));
    
    if (deviceData.ethernetMAC !== undefined) 
        variables.push(D.device.createVariable("ethernet-mac", "Ethernet MAC", deviceData.ethernetMAC, null, D.valueType.STRING));
    
    if (deviceData.hwVersion !== undefined) 
        variables.push(D.device.createVariable("hw-version", "Hardware Version", deviceData.hwVersion, null, D.valueType.STRING));
    
    if (deviceData.modelName !== undefined) 
        variables.push(D.device.createVariable("model-name", "Model Name", deviceData.modelName, null, D.valueType.STRING));
    
    if (deviceData.serialNumber !== undefined) 
        variables.push(D.device.createVariable("serial-number", "Serial Number", deviceData.serialNumber, null, D.valueType.STRING));
    
    if (deviceData.systemName !== undefined) 
        variables.push(D.device.createVariable("system-name", "System Name", deviceData.systemName, null, D.valueType.STRING));
    
    if (deviceData.wifiMAC !== undefined) 
        variables.push(D.device.createVariable("wifi-mac", "WiFi MAC", deviceData.wifiMAC, null, D.valueType.STRING));
    
    if (deviceData.deviceName !== undefined) 
        variables.push(D.device.createVariable("device-name", "Device Name", deviceData.deviceName, null, D.valueType.STRING));
    
    if (deviceData.serviceProvider !== undefined) 
        variables.push(D.device.createVariable("service-provider", "Service Provider", deviceData.serviceProvider, null, D.valueType.STRING));
}

/**
 * Creates device insights variables based on the device insights data.
 * @param {Object} insightsData - The device insights data from the API response.
 */
function createDeviceInsightsVariables(insightsData) {
    if (insightsData.deviceState !== undefined) 
        variables.push(D.device.createVariable("device-state", "Device State", insightsData.deviceState, null, D.valueType.STRING));
    
    if (insightsData.micState !== undefined) 
        variables.push(D.device.createVariable("mic-state", "Microphone State", insightsData.micState, null, D.valueType.STRING));
    
    if (insightsData.speakerState !== undefined) 
        variables.push(D.device.createVariable("speaker-state", "Speaker State", insightsData.speakerState, null, D.valueType.STRING));
    
    if (insightsData.speakerMaxVolume !== undefined) 
        variables.push(D.device.createVariable("speaker-max-volume", "Speaker Max Volume", insightsData.speakerMaxVolume, null, D.valueType.NUMBER));
    
    if (insightsData.speakerVolume !== undefined) 
        variables.push(D.device.createVariable("speaker-volume", "Speaker Volume", insightsData.speakerVolume, null, D.valueType.NUMBER));
}

/**
 * Helper function to convert camelCase or other formats to a readable display name
 * @param {string} str - The property name to convert
 * @returns {string} - A readable display name
 */
function formatDisplayName(str) {
    if (!str) return str;
    
    // Convert camelCase to space-separated words and capitalize
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capital letters
        .replace(/^./, function(match) { return match.toUpperCase(); }); // Capitalize first letter
}

/**
 * Helper function to create variable ID from property path
 * @param {Array} pathParts - Array of property names forming the path
 * @returns {string} - Sanitized variable ID
 */
function createVariableId(pathParts) {
    return sanitize(pathParts.join("-").toLowerCase());
}

/**
 * Helper function to create display name from property path
 * @param {Array} pathParts - Array of property names forming the path
 * @returns {string} - Human-readable display name
 */
function createDisplayName(pathParts) {
    return pathParts.map(function(part) {
        return formatDisplayName(part);
    }).join(" ");
}

/**
 * Recursive helper function to walk room insights data
 * @param {Object} data - The data object to traverse
 * @param {Array} basePath - The current path in the object hierarchy
 */
function traverseRoomInsightsData(data, basePath) {
    for (var property in data) {
        if (data.hasOwnProperty(property) && data[property] !== undefined) {
            var value = data[property];
            var currentPath = basePath.concat([property]);
            
            // Check if the value is a nested object (but not null)
            if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
                console.info("Traversing nested object:", property);
                // Recursively traverse nested objects
                traverseRoomInsightsData(value, currentPath);
            } else {
                // Create variable for primitive values
                var variableId = createVariableId(currentPath);
                var displayName = createDisplayName(currentPath);
                var valueType = getValueType(value);
                
                // Convert boolean values to string for consistency
                var finalValue = (typeof value === 'boolean') ? value.toString() : value;
                
                console.info("Creating room insights variable:", variableId, "with display name:", displayName, "value:", finalValue);
                
                // Create the variable
                variables.push(D.device.createVariable(variableId, displayName, finalValue, null, valueType));
            }
        }
    }
}

/**
 * Creates room insights variables based on the room insights data.
 * This function dynamically walks any room insights structure returned by the API.
 * @param {Object} roomData - The room insights data from the API response.
 */
function createRoomInsightsVariables(roomData) {
    console.info("Walking room insights data dynamically");
    traverseRoomInsightsData(roomData, []);
}

/**
 * Helper function to capitalize the first letter of a string
 * @param {string} str - The string to capitalize
 * @returns {string} - The string with the first letter capitalized
 */
function capitalizeFirstLetter(str) {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Helper function to determine the appropriate data type based on value
 * @param {any} value - The value to check
 * @returns {string} - The D.valueType to use
 */
function getValueType(value) {
    if (typeof value === 'number') {
        return D.valueType.NUMBER;
    } else if (typeof value === 'boolean') {
        return D.valueType.STRING; // Store boolean as string for consistency
    } else {
        return D.valueType.STRING;
    }
}

/**
 * Creates peripherals variables based on the peripherals data.
 * This function dynamically handles any peripheral structure returned by the API.
 * @param {Object} peripheralsData - The peripherals data from the API response.
 */
function createPeripheralsVariables(peripheralsData) {
    // Iterate through all properties in peripheralsData
    for (var peripheralType in peripheralsData) {
        if (peripheralsData.hasOwnProperty(peripheralType)) {
            var peripheralArray = peripheralsData[peripheralType];
            
            // Check if the property is an array (peripheral collection)
            if (Array.isArray(peripheralArray)) {
                console.info("Handling peripheral type:", peripheralType);
                
                // Handle each item in the peripheral array
                for (var i = 0; i < peripheralArray.length; i++) {
                    var peripheralItem = peripheralArray[i];
                    var itemIndex = i.toString();
                    
                    // Handle all properties of the peripheral item
                    for (var propertyName in peripheralItem) {
                        if (peripheralItem.hasOwnProperty(propertyName) && peripheralItem[propertyName] !== undefined) {
                            var propertyValue = peripheralItem[propertyName];
                            
                            // Create the variable ID (sanitized for internal use)
                            var variableId = sanitize("peripherals-" + peripheralType.toLowerCase() + "-" + itemIndex + "-" + propertyName.toLowerCase());
                            
                            // Create the display name with proper capitalization and new format
                            var displayName = "Peripherals - " + capitalizeFirstLetter(peripheralType) + " - " + capitalizeFirstLetter(propertyName);
                            
                            // Determine the appropriate value type
                            var valueType = getValueType(propertyValue);
                            
                            // Convert boolean values to string for consistency
                            var finalValue = (typeof propertyValue === 'boolean') ? propertyValue.toString() : propertyValue;
                            
                            console.info("Creating variable:", variableId, "with display name:", displayName, "value:", finalValue);
                            
                            // Create the variable
                            variables.push(D.device.createVariable(variableId, displayName, finalValue, null, valueType));
                        }
                    }
                }
            } else {
                console.info("Skipping non-array property:", peripheralType);
            }
        }
    }
}

//Extracts device configuration data and creates device variables
function extractDeviceConfigData(body) {
    console.info("Extracting device config data from response:", body);
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.code === 200 && responseData.result) {
            console.info("Device configuration data retrieved successfully");
            createDeviceInfoVariables(responseData.result);
            return true;
        } else {
            console.error("Invalid device config response:", body);
            return false;
        }
    } catch (parseError) {
        console.error("Failed to parse device config response:", parseError);
        return false;
    }
}

//Extracts device insights data and creates device insights variables
function extractDeviceInsightsData(body) {
    console.info("Extracting device insights data from response:", body);
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.code === 200 && responseData.result) {
            console.info("device insights data retrieved successfully");
            createDeviceInsightsVariables(responseData.result);
            return true;
        } else {
            console.error("Invalid device insights response:", body);
            return false;
        }
    } catch (parseError) {
        console.error("Failed to parse device insights response:", parseError);
        return false;
    }
}

//Extracts room insights data and creates room insights variables
function extractRoomInsightsData(body, collabOSVersion) {
    console.info("Extracting room insights data from response:", body);
    
    // Check if body is null (API not available for this version)
    if (body === null) {
        console.info("Room insights API not available for CollabOS version:", collabOSVersion);
        variables.push(D.device.createVariable("get-room-insights", "Get Room Insights", "not available as CollabOS not 1.15+", null, D.valueType.STRING));
        return true;
    }
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.code === 200 && responseData.result) {
            console.info("room insights data retrieved successfully");
            createRoomInsightsVariables(responseData.result);
            return true;
        } else {
            console.error("Invalid room insights response:", body);
            variables.push(D.device.createVariable("get-room-insights", "Get Room Insights", "not available as CollabOS not 1.15+", null, D.valueType.STRING));
            return true;
        }
    } catch (parseError) {
        console.error("Failed to parse room insights response:", parseError);
        variables.push(D.device.createVariable("get-room-insights", "Get Room Insights", "not available as CollabOS not 1.15+", null, D.valueType.STRING));
        return true;
    }
}

//Extracts peripherals data and creates peripherals variables
function extractPeripheralsData(body) {
    console.info("Extracting peripherals data from response:", body);
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.code === 200 && responseData.result) {
            console.info("peripherals data retrieved successfully");
            createPeripheralsVariables(responseData.result);
            return true;
        } else {
            console.error("Invalid peripherals response:", body);
            return false;
        }
    } catch (parseError) {
        console.error("Failed to parse peripherals response:", parseError);
        return false;
    }
}

//Helper function to check if CollabOS version is 1.15 or higher
function isCollabOSVersionSupported(version) {
    if (!version) return false;
    
    try {
        // Extract version numbers (assuming format like "1.15.0" or "1.15")
        var versionParts = version.split('.');
        var major = parseInt(versionParts[0]);
        var minor = parseInt(versionParts[1]);
        
        return (major > 1) || (major === 1 && minor >= 15);
    } catch (e) {
        console.error("Error parsing CollabOS version:", e);
        return false;
    }
}

/**
 * @remote_procedure
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection to the Logitech device.
 */
function validate(){
    login()
        .then(function (token) {
            if (token) {
                console.info("Validation successful - connection established");
                D.success();
            } else {
                console.error("Validation failed - no auth token received");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error("Validation error:", err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Device Status
 * @documentation This procedure is used to retrieve device information, device insights, room insights, and peripherals data from the Logitech device and create device variables.
 */
function get_status() {
    // Clear variables array for fresh data
    variables = [];
    var collabOSVersion = null;
    
    login()
        .then(function(token) {
            console.info("Authentication successful, proceeding with data retrieval");
            
            // First get device config to extract CollabOS version
            return getDeviceConfig();
        })
        .then(function(deviceConfigResponse) {
            // Extract device config data and get CollabOS version
            var deviceConfigSuccess = extractDeviceConfigData(deviceConfigResponse);
            
            // Extract CollabOS version from response for room insights check
            try {
                var configData = JSON.parse(deviceConfigResponse);
                if (configData.code === 200 && configData.result && configData.result.collabOSVersion) {
                    collabOSVersion = configData.result.collabOSVersion;
                    console.info("CollabOS version detected:", collabOSVersion);
                }
            } catch (e) {
                console.error("Error extracting CollabOS version:", e);
            }
            
            // Now fetch remaining data in parallel, with conditional room insights call
            var apiCalls = [
                getDeviceInsights(),
                getPeripheralsData()
            ];
            
            // Only call room insights if CollabOS version is 1.15+
            if (isCollabOSVersionSupported(collabOSVersion)) {
                console.info("CollabOS version supports room insights, including in API calls");
                apiCalls.push(getRoomInsights());
            } else {
                console.info("CollabOS version does not support room insights or version unknown");
                apiCalls.push(D.q.resolve(null)); // Add null as placeholder for room insights
            }
            
            return D.q.all(apiCalls);
        })
        .then(function(responses) {
            var deviceInsightsResponse = responses[0];
            var peripheralsResponse = responses[1];
            var roomInsightsResponse = responses[2];
            
            var deviceInsightsSuccess = extractDeviceInsightsData(deviceInsightsResponse);
            var peripheralsSuccess = extractPeripheralsData(peripheralsResponse);
            var roomInsightsSuccess = extractRoomInsightsData(roomInsightsResponse, collabOSVersion);
            
            if (deviceInsightsSuccess || peripheralsSuccess || roomInsightsSuccess) {
                console.info("Data extraction completed successfully");
                D.success(variables);
            } else {
                console.error("Failed to extract data from all responses");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error("Get status error:", err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}