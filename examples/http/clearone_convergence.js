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
 *    - apiKey: Communicate with http api using API-X-KEY
 *    
 * Custom Driver Variables:
 *    - Model: The model device.
 *    - Serial Number: The serial number device.
 *    - Firmware Version: Firmware version in device. (When * is shown means firmware pending update)
 *    - Locate Mode: True when the device is mode locate, false otherwise.
 *    - Status: Status device (STATUS - TIME IN THIS STATUS)
 *    - Location: Location device.
 *    - Part Number: Part number device.
 *
 **/

// Url access to Convergence
var urlCl = D.getParameter('urlCl');

// API Key access to Convergence
var apiKey = D.getParameter('apiKey');

/**
 * @param {string} url  The URL to perform the GET request
 * @returns promise for http response body
 */
function httpGet(url) {
    var d = D.q.defer();
	var website = D.createExternalDevice(urlCl);
    var config = {
        url: url,
		protocol: "http:",
		port: 8080,
		headers: {
			"X-Api-Key": apiKey,
		},
    };
    website.http.get(config, function (error, response, body) {
		if (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode === 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// Get device information
function getData() {
    var output = {};
    return httpGet("/dashboard-back/api/devices/pro-audio/search?q=" + D.device.ip())
          .then(function (data) {
            output.deviceInfo = data;
            if (data.avDevices && data.avDevices.length > 0) {
                return httpGet("/dashboard-back/api/devices/pro-audio/" + data.avDevices[0].id)
                    .then(function (result) {
                        output.partNumberInfo = result;
                        return output;
                    })
            } else {
                console.error("No data available");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
}

function extractVariables(data) {
    var deviceInfo = data.deviceInfo.avDevices[0];
    var firmware = deviceInfo.firmwareVersion;
    if (deviceInfo.hasNewFirmware) {
        firmware = firmware + ' *';
    }
    var variables = [
        D.createVariable("product-model", "Model", deviceInfo.productModel),
        D.createVariable("serial-number", "Serial Number", deviceInfo.serialNumber),
        D.createVariable("firmware-version", "Firmware Version", firmware),
        D.createVariable("locate-mode", "Locate Mode", deviceInfo.locateMode),
        D.createVariable("relative-status", "Status", deviceInfo.relativeStatus),
        D.createVariable("location", "Location", deviceInfo.location),
        D.createVariable("part-number", "Part Number", data.partNumberInfo.partNumber)
    ];
    D.success(variables);
}

/**
 * @remote_procedure
 * @label Validate ClearOne Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate() {
    getData()
        .then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get ClearOne informatioon
 * @documentation This procedure is used to extract information for ClearOne devices
 */
function get_status() {
    getData()
        .then(extractVariables)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}