/**
 * Domotz Custom Driver 
 * Name: Crestron Touch Screen (TSW)
 * Description: This custom driver is designed to collect information for Crestron Touch Screen device's calendar synchronizations.
 *   
 * Communication protocol is HTTPS
 * 
 * Tested with Crestron TSW-760 version: 3.002.1025 
 *
 * Custom Driver Variables:
 *      - CalendarSyncStatus: Monitors the synchronization status of the device's calendar.
 *      - ConnectionStatus: Tracks the device's connection status.
 *      - ConnectionStatusMessage: Provides a message related to the connection status.
 *      - ExchangeRegistrationStatus: Monitors the registration status of the device with Microsoft Exchange.
 *
 **/

//Processes the HTTP response and handles errors
function processResponse(d) {
    return function process(err, response, body) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode >= 400 && response.statusCode < 500) {
            console.error("error status: " + response.statusCode);
            if (response.statusCode == 401 || response.statusCode == 403) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(body);
    };
}

/**
 * @returns A promise that resolves when the login is successful.
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/userlogin.html",
        headers: {
            Origin: "https://" + D.device.ip(),
            Referer: "https://" + D.device.ip() + "/userlogin.html"
        },
        form: {
            login: D.device.username(),
            passwd: D.device.password(),
        },
        protocol: "https",
        jar: true,
        rejectUnauthorized: false
    };

    D.device.http.post(config, processResponse(d));
    return d.promise;
}

//Retrieves device information from the Crestron TSW.
function getDevice() {
    var d = D.q.defer();
    var config = {
        url: "/Device",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

//Extracts monitoring variables from the HTTP response body.
function extractVars(body) {
    var data = JSON.parse(body);
    return [
        D.createVariable("calendar_sync_status", "CalendarSyncStatus", data.Device.SchedulingPanel.Monitoring.Scheduling.CalendarSyncStatus, null, D.valueType.STRING ),
        D.createVariable("connection_status", "ConnectionStatus", data.Device.SchedulingPanel.Monitoring.Scheduling.ConnectionStatus, null, D.valueType.STRING),
        D.createVariable("connection_status_message", "ConnectionStatusMessage", data.Device.SchedulingPanel.Monitoring.Scheduling.ConnectionStatusMessage, null, D.valueType.STRING),
        D.createVariable("exchange_registration_status", "ExchangeRegistrationStatus", data.Device.SchedulingPanel.Monitoring.Scheduling.Exchange.Registration.ExchangeRegistrationStatus, null, D.valueType.STRING),
    ];
}

/**
 * @remote_procedure
 * @label Validate TSW Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    login()
        .then(getDevice)
        .then(function (deviceResponse) {
            if (deviceResponse) {
                console.info("Data available");
                D.success();
            } else {
                console.error("No data available");
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
 * @label Get Device 
 * @documentation This procedure is used to extract monitoring parameters from Crestron TSW.
 */
function get_status() {
    login()
        .then(getDevice)
        .then(extractVars)
        .then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}
