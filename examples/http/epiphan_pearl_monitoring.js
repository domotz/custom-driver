/**
 * Domotz Custom Driver 
 * Name: Epiphan Basic Driver
 * Description: Monitors basic system information of an Epiphan device using the REST API
 * 
 * Communication protocol is HTTPS with basic authentication
 * 
 * Creates device variables for:
 *      - System identification (name, location, description)
 *      - Firmware information (version, revision, product name, product ID)
 *      - System status (uptime, CPU load, CPU temperature)
 *      - Network connectivity (external IP, DNS, HTTP/HTTPS, mDNS status)
 *      - Storage status (state, total space, free space)
 * 
 **/

/**
 * @description httpsPort
 * @type NUMBER 
 */
var httpsPort = D.getParameter('httpsPort');

/**
 * Fetches system identification data from the Epiphan device
 * @returns {Promise} A promise that resolves with the JSON response containing system identification data
 */
function getSystemIdent() {
    const d = D.q.defer()
    D.device.http.get({
        url: "/api/v2.0/system/ident",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        port: httpsPort,
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    }, function (error, response, body) {
        if (error) {
            console.error("Error fetching system ident: " + error)
            d.reject(error)
        } else if (response.statusCode === 401) {
            console.error("Authentication failed for system ident")
            d.reject("Authentication failed")
        } else if (response.statusCode !== 200) {
            console.error("HTTP error " + response.statusCode + " for system ident")
            d.reject("HTTP error: " + response.statusCode)
        } else {
            try {
                d.resolve(JSON.parse(body))
            } catch (parseError) {
                console.error("Failed to parse system ident response: " + parseError)
                d.reject(parseError)
            }
        }
    })
    return d.promise
}

/**
 * Fetches firmware information from the Epiphan device
 * @returns {Promise} A promise that resolves with the JSON response containing firmware data
 */
function getSystemFirmware() {
    const d = D.q.defer()
    D.device.http.get({
        url: "/api/v2.0/system/firmware",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        port: httpsPort,
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    }, function (error, response, body) {
        if (error) {
            console.error("Error fetching system firmware: " + error)
            d.reject(error)
        } else if (response.statusCode === 401) {
            console.error("Authentication failed for system firmware")
            d.reject("Authentication failed")
        } else if (response.statusCode !== 200) {
            console.error("HTTP error " + response.statusCode + " for system firmware")
            d.reject("HTTP error: " + response.statusCode)
        } else {
            try {
                d.resolve(JSON.parse(body))
            } catch (parseError) {
                console.error("Failed to parse system firmware response: " + parseError)
                d.reject(parseError)
            }
        }
    })
    return d.promise
}

/**
 * Fetches system status from the Epiphan device
 * @returns {Promise} A promise that resolves with the JSON response containing system status data
 */
function getSystemStatus() {
    const d = D.q.defer()
    D.device.http.get({
        url: "/api/v2.0/system/status",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        port: httpsPort,
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    }, function (error, response, body) {
        if (error) {
            console.error("Error fetching system status: " + error)
            d.reject(error)
        } else if (response.statusCode === 401) {
            console.error("Authentication failed for system status")
            d.reject("Authentication failed")
        } else if (response.statusCode !== 200) {
            console.error("HTTP error " + response.statusCode + " for system status")
            d.reject("HTTP error: " + response.statusCode)
        } else {
            try {
                d.resolve(JSON.parse(body))
            } catch (parseError) {
                console.error("Failed to parse system status response: " + parseError)
                d.reject(parseError)
            }
        }
    })
    return d.promise
}

/**
 * Fetches network connectivity details from the Epiphan device
 * @returns {Promise} A promise that resolves with the JSON response containing connectivity data
 */
function getSystemConnectivity() {
    const d = D.q.defer()
    D.device.http.get({
        url: "/api/v2.0/system/connectivity/details",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        port: httpsPort,
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    }, function (error, response, body) {
        if (error) {
            console.error("Error fetching system connectivity: " + error)
            d.reject(error)
        } else if (response.statusCode === 401) {
            console.error("Authentication failed for system connectivity")
            d.reject("Authentication failed")
        } else if (response.statusCode !== 200) {
            console.error("HTTP error " + response.statusCode + " for system connectivity")
            d.reject("HTTP error: " + response.statusCode)
        } else {
            try {
                d.resolve(JSON.parse(body))
            } catch (parseError) {
                console.error("Failed to parse system connectivity response: " + parseError)
                d.reject(parseError)
            }
        }
    })
    return d.promise
}

/**
 * Fetches storage status from the Epiphan device
 * @returns {Promise} A promise that resolves with the JSON response containing storage data
 */
function getSystemStorage() {
    const d = D.q.defer()
    D.device.http.get({
        url: "/api/v2.0/system/storages/main/status",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        port: httpsPort,
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    }, function (error, response, body) {
        if (error) {
            console.error("Error fetching system storage: " + error)
            d.reject(error)
        } else if (response.statusCode === 401) {
            console.error("Authentication failed for system storage")
            d.reject("Authentication failed")
        } else if (response.statusCode !== 200) {
            console.error("HTTP error " + response.statusCode + " for system storage")
            d.reject("HTTP error: " + response.statusCode)
        } else {
            try {
                d.resolve(JSON.parse(body))
            } catch (parseError) {
                console.error("Failed to parse system storage response: " + parseError)
                d.reject(parseError)
            }
        }
    })
    return d.promise
}

/**
 * Creates variables from all API responses
 * @returns {Promise} A promise that resolves with an array of variables
 */
function createVariables() {
    const d = D.q.defer()
    const variables = []
    
    // Execute all API calls in parallel
    D.q.all([
        getSystemIdent(),
        getSystemFirmware(),
        getSystemStatus(),
        getSystemConnectivity(),
        getSystemStorage()
    ]).then(function(responses) {
        const identData = responses[0]
        const firmwareData = responses[1]
        const statusData = responses[2]
        const connectivityData = responses[3]
        const storageData = responses[4]
        
        // System Identification variables
        if (identData && identData.status === "ok" && identData.result) {
            const ident = identData.result
            variables.push(D.createVariable("system-name", "System Name", ident.name || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("system-location", "System Location", ident.location || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("system-description", "System Description", ident.description || "N/A", null, D.valueType.STRING))
        }
        
        // Firmware variables
        if (firmwareData && firmwareData.status === "ok" && firmwareData.result) {
            const firmware = firmwareData.result
            variables.push(D.createVariable("firmware-version", "Firmware Version", firmware.version || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("firmware-revision", "Firmware Revision", firmware.revision || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("product-name", "Product Name", firmware.product_name || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("product-id", "Product ID", firmware.product_id || "N/A", null, D.valueType.NUMBER))
        }
        
        // System Status variables
        if (statusData && statusData.status === "ok" && statusData.result) {
            const status = statusData.result
            variables.push(D.createVariable("system-uptime", "System Uptime", status.uptime || 0, "seconds", D.valueType.NUMBER))
            variables.push(D.createVariable("cpu-load", "CPU Load", status.cpuload || 0, "%", D.valueType.NUMBER))
            variables.push(D.createVariable("cpu-temperature", "CPU Temperature", status.cputemp || 0, "°C", D.valueType.NUMBER))
        }
        
        // Connectivity variables
        if (connectivityData && connectivityData.status === "ok" && connectivityData.result) {
            const connectivity = connectivityData.result
            variables.push(D.createVariable("external-ip", "External IP", connectivity.external_ip || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("dns-status", "DNS Status", connectivity.dns || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("http-status", "HTTP Status", connectivity.http || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("https-status", "HTTPS Status", connectivity.https || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("mdns-name", "mDNS Name", connectivity.mdns || "N/A", null, D.valueType.STRING))
        }
        
        // Storage variables
        if (storageData && storageData.status === "ok" && storageData.result) {
            const storage = storageData.result
            variables.push(D.createVariable("storage-state", "Storage State", storage.state || "N/A", null, D.valueType.STRING))
            variables.push(D.createVariable("storage-total", "Storage Total", storage.total || 0, "bytes", D.valueType.NUMBER))
            variables.push(D.createVariable("storage-free", "Storage Free", storage.free || 0, "bytes", D.valueType.NUMBER))
            
            // Calculate storage usage percentage
            if (storage.total && storage.free) {
                const used = storage.total - storage.free
                const usagePercent = Math.round((used / storage.total) * 100)
                variables.push(D.createVariable("storage-usage", "Storage Usage", usagePercent, "%", D.valueType.NUMBER))
            }
        }
        
        d.resolve(variables)
    }).catch(function(error) {
        console.error("Error creating variables: " + error)
        d.reject(error)
    })
    
    return d.promise
}

/**
 * @remote_procedure
 * @label Validate Epiphan device
 * @documentation This procedure validates the presence of an Epiphan device by checking the availability of the system identification API endpoint
 */
function validate(){
    getSystemIdent()
        .then(function (response) {
            if (response && response.status === "ok" && response.result) {
                console.info("Epiphan device validation successful. Device name: " + (response.result.name || "Unknown"))
                D.success()
            } else {
                console.error("Invalid response format from Epiphan device")
                D.failure(D.errorType.GENERIC_ERROR)
            }
        })
        .catch(function (err) {
            console.error("Epiphan device validation failed: " + err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get Epiphan System Information
 * @documentation This procedure retrieves comprehensive system information from the Epiphan device including identification, firmware, status, connectivity, and storage details.
 */
function get_status() {
    createVariables()
        .then(function(variables) {
            D.success(variables)
        })
        .catch(function (err) {
            console.error("Failed to retrieve Epiphan system information: " + err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * Executes a POST action to the Epiphan device API
 * @param {string} urlPath The API endpoint path to call
 */
function executeAction(urlPath) {
    function actionCallback(error, response, body) {
        if (error) {
            console.error("Error executing action: " + error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (response.statusCode === 401) {
            console.error("Authentication failed for action")
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode !== 200) {
            console.error("HTTP error " + response.statusCode + " for action")
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            try {
                const result = JSON.parse(body)
                if (result && result.status === "ok") {
                    console.log("Action executed successfully: " + urlPath)
                    D.success()
                } else {
                    console.error("Action failed: " + (result.message || "Unknown error"))
                    D.failure(D.errorType.GENERIC_ERROR)
                }
            } catch (parseError) {
                console.error("Failed to parse action response: " + parseError)
                D.failure(D.errorType.PARSING_ERROR)
            }
        }
    }
    
    console.log("Executing POST action: " + urlPath)
    D.device.http.post({
        url: urlPath,
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        port: httpsPort,
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    }, actionCallback)
}

/**
* @remote_procedure
* @label Recorder 1 Stop
* @documentation Recorder 1 Stop
*/
function custom_1(){
    executeAction("/api/v2.0/recorders/1/control/stop")
}
/**
* @remote_procedure
* @label Recorder 1 Start
* @documentation Recorder 1 Start
*/
function custom_2(){
    executeAction("/api/v2.0/recorders/1/control/start")
}

/**
* @remote_procedure
* @label Publishers 1 Stop
* @documentation Publishers 1 Stop
*/
function custom_3(){
    executeAction("/api/v2.0/channels/1/publishers/control/stop")
}
/**
* @remote_procedure
* @label Publishers 1 Start
* @documentation Publishers 1 Start
*/
function custom_4(){
    executeAction("/api/v2.0/channels/1/publishers/control/start")
}
/**
* @remote_procedure
* @label Touch Control 0 Togg
* @documentation Touch Control 0 Toggle
*/
function custom_5(){
    executeAction("/api/v2.0/system/singletouchcontrol/0/control/toggle")
}
/**
* @remote_procedure
* @label Presets Default Appl
* @documentation Presets Default Apply
*/
function custom_6(){
    executeAction("/api/v2.0/system/presets/Default/control/apply")
}
/**
* @remote_procedure
* @label Reboot
* @documentation Reboot
*/
function custom_7(){
    executeAction("/api/v2.0/system/control/reboot")
}