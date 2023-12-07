/**
 * Domotz Custom Driver 
 * Name: ClearOne Converge
 * Description: This script extracts information for ClearOne devices
 * 
 * Communication protocol is HTTP
 * 
 * Tested with ClearOne Converge Pro 2 
 *
 * Parameters: 
 *    - urlCl: Url access to Convergence
 *    
 * Custom Driver Variables:
 *    - Model: The model device
 *    - Serial Number: The serial number device
 *    - Firmware Version: Firmware version in device. (When * is shown means firmware pending update)
 *    - Locate Mode: True when the device is mode locate, false otherwise
 *    - Status: Status device (STATUS - TIME IN THIS STATUS)
 *    - Location: Location device
 *    - Part Number: Part number device
 *
 **/

// Url access to Convergence
var urlCl = D.getParameter('urlCl');

var deviceInfo, detailInfo;

/**
 * @param {string} url  The URL to perform the GET request
 * @returns promise for http response body
 */
function httpGet(url) {
    var d = D.q.defer();
	var website = D.createExternalDevice(urlCl);
    var config = {
        url: url,
        port: 8080,
        headers: {
			"X-Api-Key": D.device.password() //api key == password
		}
    };
    website.http.get(config, function (error, response, body) {
		if (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } 
        else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } 
        else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

/**
 * @returns promise for http response body containig device information
 */
function search() {
    return httpGet("/dashboard-back/api/devices/pro-audio/search?q=" + D.device.ip())
        .then(function(data){
            if (data && data.avDevices && data.avDevices.length > 0) {
                deviceInfo = data.avDevices[0];
            } else {
               console.error("No avDevices found in the response")
               D.failure(D.errorType.GENERIC_ERROR);
            }
        });
}

/**
 * @returns promise for http response body containig detailed information
 */
function getDetail() {
    return httpGet("/dashboard-back/api/devices/pro-audio/" + deviceInfo.id)
        .then(function(output){
            detailInfo = output;
        });
}

// Function to extract variables
function extractVariables() {
    var firmware = deviceInfo.firmwareVersion;
    if (deviceInfo.hasNewFirmware) {
        firmware = firmware + ' *';
    }
    var variables = [
        D.createVariable("product-model", "Model", deviceInfo.productModel, null, D.valueType.STRING ),
        D.createVariable("serial-number", "Serial Number", deviceInfo.serialNumber, null, D.valueType.STRING ),
        D.createVariable("firmware-version", "Firmware Version", firmware, null, D.valueType.STRING ),
        D.createVariable("locate-mode", "Locate Mode", deviceInfo.locateMode, null, D.valueType.STRING ),
        D.createVariable("relative-status", "Status", deviceInfo.relativeStatus, null, D.valueType.STRING ),
        D.createVariable("location", "Location", deviceInfo.location, null, D.valueType.STRING )
    ];

    if (detailInfo && detailInfo.partNumber) {
        variables.push(D.createVariable("part-number", "Part Number", detailInfo.partNumber, null, D.valueType.STRING));
    } else {
        console.error("No detailInfo or partNumber available in the data");
    }

    D.success(variables);
}

/**
 * @remote_procedure
 * @label Validate ClearOne Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    search()
        .then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get ClearOne information
 * @documentation This procedure is used to extract information for ClearOne devices
 */
function get_status() {
    search()
        .then(getDetail)
        .then(extractVariables)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}