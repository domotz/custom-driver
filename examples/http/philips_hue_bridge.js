/**
 * This Driver Extracts Philips Hue Lights information from a Hue Bridge.
 * Communication protocol is HTTPS.
 * Creates a Custom Driver Table with the following columns and values for each light connected:
 *   - Id
 *   - Name
 *   - State
 *   - Brightness
 *   - Software Version
 *   - Update Available
 */

// The HTTP options for the API request
var httpOptions = {
    url: "/api/" + D.device.password() + "/lights",
    rejectUnauthorized: false,
    protocol: "https"
};

// Utility function to validate that the response is not in an erroneous state
function validateResponse(response) {
    if (response.statusCode === 401) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode !== 200) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    }
}

/**
* @remote_procedure
* @label Is Philips Hue Bridge
* @documentation Validates the credentials are correct and hue rest API resource is accessible
*/
function validate() {
    function callbackMethod(error, response, body) {
        validateResponse(response);
        D.success();
    }
    D.device.http.get(httpOptions, callbackMethod);
}

/**
* @remote_procedure
* @label Get Hue Lights Info
* @documentation Retrieves information about the philips hue lights connected to the bridge
*/
function get_status() {
    var table = D.createTable(
        "Philips Hue Lights",
        [
            { label: "Name" },
            { label: "State" },
            { label: "Brightness", unit: "lux" },
            { label: "Software Version" },
            { label: "Update Available" }
        ]
    );
    function callbackMethod(error, response, body) {
        validateResponse(response);
        var lights = JSON.parse(body);
        for (var index in lights) {
            var name = lights[index].name;
            var brightness = lights[index].state.bri;
            var softwareVersion = lights[index].swversion;
            var softwareUpdateAvailable = lights[index].swupdate.state;
            var state = "OFF";
            if (lights[index].state.on) {
                state = "ON";
            }

            table.insertRecord(
                index, [name, state, brightness, softwareVersion, softwareUpdateAvailable]
            );

        }
        D.success(table);
    }

    // httpOptions.url already points to /api/<key>/lights
    D.device.http.get(httpOptions, callbackMethod);
}
