/**
 * This Driver monitors Neat Pulse endpoints (room devices) via the Neat Pulse cloud API.
 * Communication protocol is HTTPS (api.pulse.neat.no).
 *
 * The driver requires the following parameters:
 *   - neatAPIKey:              API Bearer token for authenticating against the Neat Pulse API.
 *   - neatOrgID:               Organization ID of the Neat Pulse account.
 *   - cloudControllerDeviceID: (Optional) Neat endpoint ID. If provided, the driver queries
 *                              that device directly, skipping the full inventory lookup.
 *                              If left empty (or null/whitespace), the driver falls back to
 *                              retrieving the full endpoint inventory and identifying the device
 *                              by matching its serial number against D.device.serial().
 *                              NOTE: at least one of the two must resolve to a valid Neat device.
 *                              If cloudControllerDeviceID is absent AND the serial number is not
 *                              found in the inventory, no error is raised but a single variable
 *                              with the message "Serial <serial> not found in Neat inventory"
 *                              is published instead of the full set of monitoring variables.
 *
 * The driver exposes the following information as custom variables:
 *   - Device info: serial, model, connectivity, firmware version, latest available version,
 *     room name, pairing serial, local IP, in-call status, OTA channel, primary mode,
 *     storage metrics (system / internal / external), automatic updates, timezone.
 *   - Sensor data (where supported by the device): temperature, humidity, CO2, VOC,
 *     VOC index, illumination, people count, shutter status.
 *
 * A Reboot action (custom_1) is also available, following the same ID resolution logic.
 */

/**
 * @description Neat API Key
 * @type SECRET_TEXT 
 */
var neatAPIKey = D.getParameter('neatAPIKey'); 

/**
 * @description Neat Org ID
 * @type STRING 
 */
var neatOrgID = D.getParameter('neatOrgID');

/**
 * @description cloudControllerDeviceID
 * @type STRING 
 */
var cloudControllerDeviceID = D.getParameter('cloudControllerDeviceID');

const neatPulseAPI = D.createExternalDevice('api.pulse.neat.no');

var variables = [];

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/function validate(){
    retrieveRegions()
    .then(D.success)
    .catch(function(error) {
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    });
} 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/function get_status(){
    try {
        if (cloudControllerDeviceID && cloudControllerDeviceID !== null && cloudControllerDeviceID.trim() !== '') {
            // Use the provided cloudControllerDeviceID directly
            retrieveEndpointBasicInfo(cloudControllerDeviceID)
            .then(retrieveEndpointSensors)
            .then(publishVariables)
            .then(D.success)
            .catch(function (error) {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            });
        } else {
            // Use the existing flow to find the device
            retrieveInventory()
            .then(findDevice)
            .then(retrieveEndpointBasicInfo)
            .then(retrieveEndpointSensors)
            .then(publishVariables)
            .then(D.success)
            .catch(function (error) {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            });
        }
    }
    catch(err) {
        console.error("Error executing get_status() function " + err)
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

function retrieveRegions() {
    const d = D.q.defer();

    const url = "/v1/orgs/" + neatOrgID + "/regions";

    callNeatPulseAPI(url, function (bodyAsJSON) {
        d.resolve();    
    });

    return d.promise;
}


function retrieveInventory() {
    const d = D.q.defer();

    const url =  "/v1/orgs/" + neatOrgID + "/endpoints";

    callNeatPulseAPI(url, function (bodyAsJSON) {
        d.resolve(bodyAsJSON.endpoints);    
    });

    return d.promise;
}

function findDevice(endpoints) {
    const d = D.q.defer();

    var device = null;
    for (var i = 0; i < endpoints.length; i++) {
      if (endpoints[i].serial === D.device.serial()) {
        device = endpoints[i];
        break;
      }
    }

    if (!device)
        D.success([D.createVariable("msg", "Message", "Serial " +  D.device.serial() + " not found in Neat inventory", null, D.valueType.STRING)]);
    else   
        d.resolve(device.id);

    return d.promise;
}

function retrieveEndpointBasicInfo(deviceID) {
    const d = D.q.defer();

    const url = "/v1/orgs/" + neatOrgID + "/endpoints/"+deviceID;

    callNeatPulseAPI(url, function (bodyAsJSON) {
        createDeviceInfoVariables(bodyAsJSON)
        d.resolve(deviceID);
    });

    return d.promise;
}

function reboot(deviceID) {
    const d = D.q.defer();

    console.info("Rebooting device " + deviceID)

    const url = "/v1/orgs/" + neatOrgID + "/endpoints/"+deviceID+"/reboot";

    callNeatPulseAPI(url, function (bodyAsJSON) {
        createDeviceInfoVariables(bodyAsJSON)
        d.resolve(deviceID);
    }, "POST");
 
    return d.promise;
}

function callNeatPulseAPI(url, responseCallback, method = "GET")
{
    const config = {
        url: url,
        protocol: "https", 
        headers: {
            "Authorization": "Bearer " + neatAPIKey,
        }, 
        rejectUnauthorized: false, 
        jar: true
    };

    if (method == "GET")
        neatPulseAPI.http.get(config, function (err, response, body) {
            checkHttpError(err, response, body);
            responseCallback(JSON.parse(body))
        });
    else
        neatPulseAPI.http.post(config, function (err, response, body) {
            checkHttpError(err, response, body);
            responseCallback(JSON.parse(body))
        });
}

function retrieveEndpointSensors(deviceID) {
    const d = D.q.defer();

    const url = "/v1/orgs/" + neatOrgID + "/endpoints/"+deviceID+"/sensor";

    callNeatPulseAPI(url, function (bodyAsJSON) {
        createDeviceSensorsVariables(bodyAsJSON)
        d.resolve();
    });

    return d.promise;
}

function publishVariables() {
    D.success(variables)
}


function pushNotAvailableVariable(id, name) {
    variables.push(D.device.createVariable(id, name, "N/A", null, D.valueType.STRING));
}

function createDeviceInfoVariables(deviceData) {
    if (deviceData.serial !== undefined) 
        variables.push(D.device.createVariable("serial", "Serial", deviceData.serial, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("serial", "Serial");
    
    if (deviceData.model !== undefined) 
        variables.push(D.device.createVariable("model", "Model", deviceData.model, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("model", "Model");
    
    if (deviceData.connected !== undefined) 
        variables.push(D.device.createVariable("connected", "Connected", deviceData.connected, null, D.valueType.BOOLEAN));
    else
        pushNotAvailableVariable("connected", "Connected");
    
    if (deviceData.upgradeStatus !== undefined) 
        variables.push(D.device.createVariable("upgrade-status", "Upgrade Status", deviceData.upgradeStatus, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("upgrade-status", "Upgrade Status");
    
    if (deviceData.firmwareVersion !== undefined) 
        variables.push(D.device.createVariable("firmware-version", "Firmware Version", deviceData.firmwareVersion, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("firmware-version", "Firmware Version");
    
    if (deviceData.latestVersion !== undefined) 
        variables.push(D.device.createVariable("latest-version", "Latest Version", deviceData.latestVersion, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("latest-version", "Latest Version");
    
    if (deviceData.roomName !== undefined) 
        variables.push(D.device.createVariable("room-name", "Room Name", deviceData.roomName, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("room-name", "Room Name");
    
    if (deviceData.pairingSerial !== undefined) 
        variables.push(D.device.createVariable("pairing-serial", "Pairing Serial", deviceData.pairingSerial, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("pairing-serial", "Pairing Serial");
    
    if (deviceData.localIpAddress !== undefined) 
        variables.push(D.device.createVariable("local-ip-address", "Local IP Address", deviceData.localIpAddress, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("local-ip-address", "Local IP Address");
    
    if (deviceData.inCallStatus !== undefined) 
        variables.push(D.device.createVariable("in-call-status", "In Call Status", deviceData.inCallStatus, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("in-call-status", "In Call Status");
    
    if (deviceData.hasScheduledFirmwareUpdate !== undefined) 
        variables.push(D.device.createVariable("has-scheduled-firmware-update", "Scheduled Firmware Update", deviceData.hasScheduledFirmwareUpdate, null, D.valueType.BOOLEAN));
    else
        pushNotAvailableVariable("has-scheduled-firmware-update", "Scheduled Firmware Update");
    
    if (deviceData.otaChannel !== undefined) 
        variables.push(D.device.createVariable("ota-channel", "OTA Channel", deviceData.otaChannel, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("ota-channel", "OTA Channel");
    
    if (deviceData.primaryMode !== undefined) 
        variables.push(D.device.createVariable("primary-mode", "Primary Mode", deviceData.primaryMode, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("primary-mode", "Primary Mode");
    
    if (deviceData.totalSystemStorage !== undefined)
        variables.push(D.device.createVariable("total-system-storage", "Total System Storage", convertToGB(deviceData.totalSystemStorage), "GB", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("total-system-storage", "Total System Storage");
        
    if (deviceData.freeSystemStorage !== undefined)
        variables.push(D.device.createVariable("free-system-storage", "Free System Storage", convertToGB(deviceData.freeSystemStorage), "GB", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("free-system-storage", "Free System Storage");

    if (deviceData.totalSystemStorage !== undefined && deviceData.freeSystemStorage !== undefined)
        variables.push(D.device.createVariable("used-system-storage", "Used System Storage", (100*(deviceData.totalSystemStorage - deviceData.freeSystemStorage) / deviceData.totalSystemStorage), "%", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("used-system-storage", "Used System Storage");

    if (deviceData.totalInternalStorage !== undefined)
        variables.push(D.device.createVariable("total-internal-storage", "Total Internal Storage", convertToGB(deviceData.totalInternalStorage), "GB", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("total-internal-storage", "Total Internal Storage");
    
    if (deviceData.freeInternalStorage !== undefined)
        variables.push(D.device.createVariable("free-internal-storage", "Free Internal Storage", convertToGB(deviceData.freeInternalStorage), "GB", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("free-internal-storage", "Free Internal Storage");

    if (deviceData.totalInternalStorage !== undefined && deviceData.freeInternalStorage !== undefined)
        variables.push(D.device.createVariable("used-internal-storage", "Used Internal Storage", (100*(deviceData.totalInternalStorage - deviceData.freeInternalStorage) / deviceData.totalInternalStorage).toFixed(2), "%", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("used-internal-storage", "Used Internal Storage");

    if (deviceData.totalExternalStorage !== undefined)
        variables.push(D.device.createVariable("total-external-storage", "Total External Storage", convertToGB(deviceData.totalExternalStorage), "GB", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("total-external-storage", "Total External Storage");
       
    if (deviceData.freeExternalStorage !== undefined)
        variables.push(D.device.createVariable("free-external-storage", "Free External Storage", convertToGB(deviceData.freeExternalStorage), "GB", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("free-external-storage", "Free External Storage");

    if (deviceData.totalExternalStorage !== undefined && deviceData.freeExternalStorage !== undefined)
        variables.push(D.device.createVariable("used-external-storage", "Used External Storage", (100*(deviceData.totalExternalStorage - deviceData.freeExternalStorage) / deviceData.totalExternalStorage).toFixed(2), "%", D.valueType.NUMBER));
    else
        pushNotAvailableVariable("used-external-storage", "Used External Storage");

    if (deviceData.automaticUpdates !== undefined) 
        variables.push(D.device.createVariable("automatic-updates", "Automatic Updates", deviceData.automaticUpdates, null, D.valueType.BOOLEAN));
    else
        pushNotAvailableVariable("automatic-updates", "Automatic Updates");
    
    if (deviceData.firmwareVersionReleaseName !== undefined) 
        variables.push(D.device.createVariable("firmware-version-release-name", "Firmware Version Release Name", deviceData.firmwareVersionReleaseName, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("firmware-version-release-name", "Firmware Version Release Name");
    
    if (deviceData.latestVersionReleaseName !== undefined) 
        variables.push(D.device.createVariable("latest-version-release-name", "Latest Version Release Name", deviceData.latestVersionReleaseName, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("latest-version-release-name", "Latest Version Release Name");
    
    if (deviceData.isLatestVersionScheduledForNow !== undefined) 
        variables.push(D.device.createVariable("is-latest-version-scheduled-for-now", "Latest Version Scheduled For Now", deviceData.isLatestVersionScheduledForNow, null, D.valueType.BOOLEAN));
    else
        pushNotAvailableVariable("is-latest-version-scheduled-for-now", "Latest Version Scheduled For Now");
    
    if (deviceData.timezone !== undefined) 
        variables.push(D.device.createVariable("timezone", "Timezone", deviceData.timezone, null, D.valueType.STRING));
    else
        pushNotAvailableVariable("timezone", "Timezone");
}

function createDeviceSensorsVariables(deviceSensors) {
    if (deviceSensors && deviceSensors.endpointData && deviceSensors.endpointData.data && deviceSensors.endpointData.data[0]) {
        var sensorData = deviceSensors.endpointData.data[0];
        var shutterClosed = deviceSensors.endpointData.shutterClosed;

        if (sensorData.temp !== undefined && sensorData.temp != 0)
            variables.push(D.device.createVariable("temperature", "Temperature", sensorData.temp, "°C", D.valueType.NUMBER));
        else
            pushNotAvailableVariable("temperature", "Temperature");

        if (sensorData.humidity !== undefined && sensorData.humidity != 0)
            variables.push(D.device.createVariable("humidity", "Humidity", sensorData.humidity, "%", D.valueType.NUMBER));
        else
            pushNotAvailableVariable("humidity", "Humidity");

        if (sensorData.co2 !== undefined && sensorData.co2 != 0)
            variables.push(D.device.createVariable("co2", "CO2", sensorData.co2, "ppm", D.valueType.NUMBER));
        else
            pushNotAvailableVariable("co2", "CO2");

        if (sensorData.voc !== undefined && sensorData.voc != 0)
            variables.push(D.device.createVariable("voc", "VOC", sensorData.voc, "ppb", D.valueType.NUMBER));
        else
            pushNotAvailableVariable("voc", "VOC");
    
        if (sensorData.vocIndex !== undefined && sensorData.vocIndex != 0) 
            variables.push(D.device.createVariable("voc-index", "VOC Index", sensorData.vocIndex, null, D.valueType.NUMBER));
        else
            pushNotAvailableVariable("voc-index", "VOC Index");
        
        if (sensorData.illumination !== undefined && sensorData.illumination != 0)
            variables.push(D.device.createVariable("illumination", "Illumination", sensorData.illumination, "lux", D.valueType.NUMBER));
        else
            pushNotAvailableVariable("illumination", "Illumination");
    
        if (sensorData.people !== undefined)
            variables.push(D.device.createVariable("people", "People Count", sensorData.people, null, D.valueType.NUMBER));
        else
            pushNotAvailableVariable("people", "People Count");
   
        if (shutterClosed !== undefined)
            variables.push(D.device.createVariable("shutter-closed", "Shutter Closed", shutterClosed, null, D.valueType.BOOLEAN));
        else
            pushNotAvailableVariable("shutter-closed", "Shutter Closed");
    }    
    else
        console.error("Sensor data not present")
}

/**
 * Converts bytes to megabytes (MB)
 * @param {number} bytes The number of bytes to convert
 * @returns {number} The value in megabytes or 'N/A'
 */
function convertToGB(bytes) {
  return formatToTwoDecimals(bytes !== 'N/A' ? bytes / (1024*1024*1024) : bytes)
} 

/**
 * Formats the value to 2 decimal places, unless it's an integer
 * If the value is not a valid number or is 'N/A', returns 'N/A'
 * @param {number|string} value The value to format (can be a string or number)
 * @returns {string} The formatted value, or 'N/A' if the value is invalid
 */
function formatToTwoDecimals(value) {
  if (isNaN(value) || value === 'N/A') {
    return 'N/A'
  }
  const numValue = parseFloat(value)
  if (Number.isInteger(numValue)) {
    return numValue.toString()
  }
  return numValue.toFixed(2)
}

/**
 * Checks for HTTP errors and handles them appropriately.
 * @param {Error} err - The error object if an error occurred during the HTTP request.
 * @param {Object} response - The HTTP response object.
 * @param {string} body - The body of the HTTP response.
 */
function checkHttpError(err, response, body) {
    /*    
    console.info(err);
    console.info(response);
    console.info(body);
    */
    
    if (err) {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
    if (response.statusCode === 429) { //Too many requests to Neat Pulse API, retry later
        createDeviceInfoVariables({})
        createDeviceSensorsVariables({})
        publishVariables();
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
    if (cloudControllerDeviceID && cloudControllerDeviceID !== null && cloudControllerDeviceID.trim() !== '') {
        // Use the provided cloudControllerDeviceID directly
        reboot(cloudControllerDeviceID)
        .then(D.success)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
    } else {
        // Use the existing flow to find the device
        retrieveInventory()
        .then(findDevice)
        .then(reboot)
        .then(D.success)
        .catch(function (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        });
    }
}


