/**
 * Domotz Custom Driver 
 * Name: Fujitsu iRMC General Monitoring 
 * Description: Monitors the general information for Fujitsu iRMC (Integrated Remote Management Controller) systems
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with Fujitsu iRMC version: S5
 *
 *  Creates a Custom Driver variables:
 *      - System Type
 *      - BIOS Version
 *      - Serial Number
 *      - System Status
 * 
 **/

// Function to make an HTTP GET request to retrieve Fujitsu device information
function getFujitsuInformation() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/redfish/v1/Systems/0",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        auth: "basic",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        jar: true,
        rejectUnauthorized: false

    }, function (error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// Function to extract relevant data from the Fujitsu device information and create variables
function extractData(data) {
    if (data.Model || data.BiosVersion || data.SerialNumber || data.Status && data.Status.Health) {
        var systemType = data.Model;
        var biosVersion = data.BiosVersion;
        var serialNumber = data.SerialNumber;
        var systemStatus = data.Status.Health;
        var variables = [
            D.createVariable("system-type", "System Type", systemType, null, D.valueType.STRING),
            D.createVariable("bios-version", "BIOS Version", biosVersion, null, D.valueType.STRING),
            D.createVariable("serial-number", "Serial Number", serialNumber, null, D.valueType.STRING),
            D.createVariable("system-status", "System Status", systemStatus, null, D.valueType.STRING)
        ];
        D.success(variables);

    } else {
        console.error("Missing required properties in the data");
        D.failure(D.errorType.PARSING_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate Fujitsu device
 * @documentation This procedure is used to validate the presence of a Fujitsu device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    getFujitsuInformation()
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Systems/0") !== -1) {
                console.info("Data available");
                D.success();
            } else {
                console.error("Desired link not found");
                D.failure(D.errorType.GENERIC_ERROR);
            }
        })
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Fujitsu information
 * @documentation This procedure is used to extract information about the Fujitsu iRMC device, System Type, BIOS Version, Serial Number and System Status.
 */
function get_status() {
    getFujitsuInformation()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}