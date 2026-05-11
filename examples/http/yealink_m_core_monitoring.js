/**
 * This driver monitors Yealink M Core series meeting room controllers via the device REST API.
 * Communication protocol is HTTPS with token-based authentication (Bearer token obtained via login).
 *
 * The driver requires the following parameter:
 *   - port: HTTPS port of the Yealink M Core device (default: 443).
 *
 * Device credentials (username and password) are configured in Domotz and used to obtain
 * a session token via POST /centralcontrol/authentication before each data retrieval cycle.
 *
 * The driver exposes the following information as custom variables:
 *   - Audio status: current mute state of the audio output.
 *   - System status: operational status of the M Core controller.
 *   - Camera position: PTZ coordinates (X, Y, Z) of the connected camera, where supported.
 *
 * The driver also populates a "Connected Devices" table listing all peripherals registered
 * to the M Core hub, with the following columns per device:
 *   Model, Firmware version, Hardware version, Serial Number, MAC Address, Device ID.
 *
 * A Reboot action (custom_1) is available: it retrieves the full device list and sends
 * a reboot command to every connected peripheral simultaneously.
 */

/**
 * @description Port number for the Yealink M Core device
 * @type NUMBER
 * @default 443
 */
var port = D.getParameter('port');

// Global variable to store auth token
var authToken = null;

// Array to store device variables
var variables = [];

// Table to store device list
var deviceTable = null;

/**
 * Processes the HTTP response and handles errors
 * @param {Object} d - Deferred promise object
 * @returns {Function} Callback function to process the response
 */
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(body);
    };
}

/**
 * Logs in to the Yealink M Core device using JSON authentication.
 * @returns {Object} A promise that resolves on successful login with auth token.
 */
function login() {
    var d = D.q.defer();
    var loginData = {
        user: D.device.username(),
        password: D.device.password()
    };
    
    var config = {
        url: "/centralcontrol/authentication",
        protocol: "https",
        port: port,
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(loginData),
        rejectUnauthorized: false
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
            if (responseData.status === 200 && responseData.data && responseData.data.token) {
                authToken = responseData.data.token;
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
 * Retrieves the list of connected devices from the Yealink M Core system.
 * @returns {Object} A promise that resolves with the device list data.
 */
function getDeviceList() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for device list request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/centralcontrol/system/devices",
        protocol: "https",
        port: port,
        headers: {
            "Authorization": "Bearer " + authToken
        },
        rejectUnauthorized: false
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("Device list request error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for device list request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("Device list request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        console.info("Device list retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

/**
 * Retrieves the audio mute status from the Yealink M Core system.
 * @returns {Object} A promise that resolves with the audio status data.
 */
function getAudioStatus() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for audio status request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/centralcontrol/audio/mute",
        protocol: "https",
        port: port,
        headers: {
            "Authorization": "Bearer " + authToken,
            "Content-Type": "application/json"
        },
        rejectUnauthorized: false
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("Audio status request error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for audio status request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("Audio status request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        console.info("Audio status retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

/**
 * Retrieves the camera position from the Yealink M Core system.
 * @returns {Object} A promise that resolves with the camera position data.
 */
function getCameraPosition() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for camera position request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/centralcontrol/camera/position",
        protocol: "https",
        port: port,
        headers: {
            "Authorization": "Bearer " + authToken
        },
        rejectUnauthorized: false
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("Camera position request error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for camera position request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("Camera position request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        console.info("Camera position retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

/**
 * Retrieves the system status from the Yealink M Core system.
 * @returns {Object} A promise that resolves with the system status data.
 */
function getSystemStatus() {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for system status request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var config = {
        url: "/centralcontrol/system/status",
        protocol: "https",
        port: port,
        headers: {
            "Authorization": "Bearer " + authToken,
            "Content-Type": "application/json"
        },
        rejectUnauthorized: false
    };
    
    D.device.http.get(config, function(error, response, body) {
        if (error) {
            console.error("System status request error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for system status request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("System status request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        console.info("System status retrieved successfully");
        d.resolve(body);
    });
    
    return d.promise;
}

/**
 * Sanitizes output strings for use as record IDs
 * @param {string} output - The string to sanitize
 * @returns {string} Sanitized string
 */
function sanitize(output) {
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * Creates a table from the device list data
 * @param {string} body - The JSON response body containing device list
 */
function createDeviceTable(body) {
    console.info("Creating device table from response:", body);
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.status === 200 && responseData.data && responseData.data['device-list']) {
            var deviceList = responseData.data['device-list'];
            
            // Create the table with appropriate columns
            deviceTable = D.createTable(
                "Connected Devices",
                [
                    { label: "Model", valueType: D.valueType.STRING },
                    { label: "Firmware", valueType: D.valueType.STRING },
                    { label: "Hardware", valueType: D.valueType.STRING },
                    { label: "Serial Number", valueType: D.valueType.STRING },
                    { label: "MAC Address", valueType: D.valueType.STRING },
                    { label: "ID", valueType: D.valueType.NUMBER }
                ]
            );
            
            // Populate the table with device data
            for (var i = 0; i < deviceList.length; i++) {
                var device = deviceList[i];
                var recordId = sanitize(device.serialnumber || device.macaddress || i.toString());
                
                deviceTable.insertRecord(recordId, [
                    device.model || "N/A",
                    device.firmware || "N/A",
                    device.hardware || "N/A",
                    device.serialnumber || "N/A",
                    device.macaddress || "N/A",
                    device.id !== undefined ? device.id : -1
                ]);
            }
            
            console.info("Device table created successfully with", deviceList.length, "devices");
        } else {
            console.error("Invalid device list response:", body);
        }
    } catch (parseError) {
        console.error("Failed to parse device list response:", parseError);
    }
}

/**
 * Creates variables from the audio status data
 * @param {string} body - The JSON response body containing audio status
 */
function createAudioStatusVariable(body) {
    console.info("Creating audio status variable from response:", body);
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.status === 200 && responseData.data && responseData.data.status !== undefined) {
            var audioStatus = responseData.data.status;
            variables.push(D.device.createVariable("audio-status", "Audio Status", audioStatus, null, D.valueType.STRING));
            console.info("Audio status variable created:", audioStatus);
        } else {
            console.error("Invalid audio status response:", body);
        }
    } catch (parseError) {
        console.error("Failed to parse audio status response:", parseError);
    }
}

/**
 * Creates variables from the system status data
 * @param {string} body - The JSON response body containing system status
 */
function createSystemStatusVariable(body) {
    console.info("Creating system status variable from response:", body);
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.status === 200 && responseData.data && responseData.data.status !== undefined) {
            var systemStatus = responseData.data.status;
            variables.push(D.device.createVariable("system-status", "System Status", systemStatus, null, D.valueType.STRING));
            console.info("System status variable created:", systemStatus);
        } else {
            console.error("Invalid system status response:", body);
        }
    } catch (parseError) {
        console.error("Failed to parse system status response:", parseError);
    }
}

/**
 * Creates variables from the camera position data
 * @param {string} body - The JSON response body containing camera position
 */
function createCameraPositionVariables(body) {
    console.info("Creating camera position variables from response:", body);
    
    try {
        var responseData = JSON.parse(body);
        
        if (responseData.status === 200 && responseData.data) {
            var position = responseData.data;
            
            if (position.x !== undefined) {
                variables.push(D.device.createVariable("camera-position-x", "Camera Position X", position.x, null, D.valueType.NUMBER));
            }
            
            if (position.y !== undefined) {
                variables.push(D.device.createVariable("camera-position-y", "Camera Position Y", position.y, null, D.valueType.NUMBER));
            }
            
            if (position.z !== undefined) {
                variables.push(D.device.createVariable("camera-position-z", "Camera Position Z", position.z, null, D.valueType.NUMBER));
            }
            
            console.info("Camera position variables created: x=" + position.x + ", y=" + position.y + ", z=" + position.z);
        } else {
            console.error("Invalid camera position response:", body);
        }
    } catch (parseError) {
        console.error("Failed to parse camera position response:", parseError);
    }
}

/**
 * @remote_procedure
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection to the Yealink M Core device.
 */
function validate() {
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
 * @documentation This procedure retrieves device list, audio status, system status, and camera position from the Yealink M Core device.
 */
function get_status() {
    // Clear variables array for fresh data
    variables = [];
    deviceTable = null;
    
    login()
        .then(function(token) {
            console.info("Authentication successful, proceeding with data retrieval");
            
            // Fetch all data in parallel
            return D.q.all([
                getDeviceList(),
                getAudioStatus(),
                getSystemStatus(),
                getCameraPosition()
            ]);
        })
        .then(function(responses) {
            var deviceListResponse = responses[0];
            var audioStatusResponse = responses[1];
            var systemStatusResponse = responses[2];
            var cameraPositionResponse = responses[3];
            
            // Process all responses
            createDeviceTable(deviceListResponse);
            createAudioStatusVariable(audioStatusResponse);
            createSystemStatusVariable(systemStatusResponse);
            createCameraPositionVariables(cameraPositionResponse);
            
            console.info("Data extraction completed successfully");
            
            // Return results with both variables and table
            if (variables.length > 0 && deviceTable) {
                D.success(variables, deviceTable);
            } else if (variables.length > 0) {
                D.success(variables);
            } else if (deviceTable) {
                D.success(deviceTable);
            } else {
                console.warn("No data collected");
                D.success();
            }
        })
        .catch(function (err) {
            console.error("Get status error:", err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * Reboots a device by serial number
 * @param {string} serialNumber - The serial number of the device to reboot
 * @returns {Object} A promise that resolves with the reboot status
 */
function rebootDevice(serialNumber) {
    var d = D.q.defer();
    
    if (!authToken) {
        console.error("No auth token available for reboot request");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return d.promise;
    }
    
    var rebootData = {
        status: "reboot",
        sn: serialNumber
    };
    
    var config = {
        url: "/centralcontrol/system/status",
        protocol: "https",
        port: port,
        headers: {
            "Authorization": "Bearer " + authToken,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(rebootData),
        rejectUnauthorized: false
    };
    
    D.device.http.post(config, function(error, response, body) {
        if (error) {
            console.error("Reboot request error for device " + serialNumber + ":", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        if (response.statusCode == 401) {
            console.error("Authentication failed for reboot request");
            D.failure(D.errorType.AUTHENTICATION_ERROR);
            return;
        }
        
        if (response.statusCode != 200) {
            console.error("Reboot request failed with status code:", response.statusCode);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }
        
        try {
            var responseData = JSON.parse(body);
            console.info("Reboot status for device " + serialNumber + ":", responseData.status);
            d.resolve(responseData);
        } catch (parseError) {
            console.error("Failed to parse reboot response:", parseError);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    });
    
    return d.promise;
}

/**
* @remote_procedure
* @label Reboot
* @documentation Reboots all devices connected to the Yealink M Core system
*/
function custom_1(){
    login()
        .then(function(token) {
            console.info("Authentication successful, proceeding to get device list");
            return getDeviceList();
        })
        .then(function(deviceListResponse) {
            console.info("Device list retrieved, parsing response");
            
            try {
                var responseData = JSON.parse(deviceListResponse);
                
                if (responseData.status === 200 && responseData.data && responseData.data['device-list']) {
                    var deviceList = responseData.data['device-list'];
                    var serialNumbers = [];
                    
                    // Extract serial numbers from device list
                    for (var i = 0; i < deviceList.length; i++) {
                        if (deviceList[i].serialnumber) {
                            serialNumbers.push(deviceList[i].serialnumber);
                        }
                    }
                    
                    console.info("Found " + serialNumbers.length + " devices to reboot");
                    console.info("Serial numbers:", serialNumbers);
                    
                    // Create an array of reboot promises
                    var rebootPromises = [];
                    for (var j = 0; j < serialNumbers.length; j++) {
                        rebootPromises.push(rebootDevice(serialNumbers[j]));
                    }
                    
                    // Execute all reboot operations
                    return D.q.all(rebootPromises);
                } else {
                    console.error("Invalid device list response:", deviceListResponse);
                    D.failure(D.errorType.GENERIC_ERROR);
                }
            } catch (parseError) {
                console.error("Failed to parse device list response:", parseError);
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .then(function(rebootResults) {
            console.info("All reboot operations completed successfully");
            console.info("Reboot results:", JSON.stringify(rebootResults));
            D.success();
        })
        .catch(function(err) {
            console.error("Reboot operation error:", err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}


