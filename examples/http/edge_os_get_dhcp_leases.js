/**
 * This Driver Extracts the DHCP Lease information for Ubiquiti EdgeOS Routers.
 * Communication protocol is HTTPS.
 * Creates a dynamic number of custom driver variables based on the number of DHCP IP addresses.
 */

var httpOptions = {
    protocol: 'https',
    jar: true,
    rejectUnauthorized: false,
    url: '/api/edge/data.json?data=dhcp_leases'
};

/**
 * Utility function.
 * Checks if the response object contains any errors.
 * Triggers Failure Callback in case of authentication error or unacceptable status codes.
 */
function validateAuthentication(response) {
    if (response.statusCode === 401 || response.statusCode === 403) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (response.statusCode >= 400) {
        D.failure(D.errorType.GENERIC_ERROR);
    };
};

/**
* Utility function.
* Authenticates with an EdgeOS device.
* Reports the DHCP lease variables.
*/
function login(callbackMethod) {
    var loginBody = 'username=' + D.device.username() + '&password=' + D.device.password();
    var httpLoginOptions = {
        protocol: 'https',
        rejectUnauthorized: false,
        url: '/',
        body: loginBody,
        jar: true,
    };
    D.device.http.post(httpLoginOptions, callbackMethod);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    function verifyCanAccessResource(error, response, body) {
        validateAuthentication(response);
        D.success();
    };
    function loginCallback(error, response, body) {
        validateAuthentication(response);
        D.device.http.get(httpOptions, verifyCanAccessResource);
    }
    login(loginCallback);
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure is used for updating the status EdgeRouter Device Custom Driver Variables for the DHCP leases
 */
function get_status() {
    function getDHCPLeasesCb(error, response, body) {
        validateAuthentication(response)
        var jsonBody = JSON.parse(body);
        var leases = jsonBody.output["dhcp-server-leases"]["HomeRouter"];
        var variables = [];
        for (var key in leases) {
            var deviceMac = leases[key].mac;
            var uid = deviceMac.replace(/:/g, '');
            var label = key;
            var value = leases[key]['expiration'];
            var variable = D.device.createVariable(
                uid,
                label,
                value
            );
            variables.push(variable);
        }
        D.success(variables);
    };
    function loginCallback(error, response, body) {
        validateAuthentication(response);
        D.device.http.get(httpOptions, getDHCPLeasesCb);
    }
    login(loginCallback);
}