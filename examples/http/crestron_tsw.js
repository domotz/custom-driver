

/**
 * 
 * @param {*} init object initialisation
 * @param {*} object object to clone
 * @returns cloned object
 */
function clone(init, object) {
    var toReturn = JSON.parse(JSON.stringify(object));
    Object.keys(init).forEach(function (key) {
        toReturn[key] = init[key];
    });
    return toReturn;
}

var http_config = {
    protocol: "https",
    jar: true,
    rejectUnauthorized: false
};

function processResponse(d) {
    return function process(err, response, body) {
        if (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        }

        if (response.statusCode >= 400 && response.statusCode < 500) {
            console.error("error status: " + response.statusCode)
            if (response.statusCode == 401 || response.statusCode == 403) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
            D.failure(D.errorType.GENERIC_ERROR);
        }

        d.resolve(body);
    }
}

function login() {
    var d = D.q.defer();
    var config = clone({
        url: "/userlogin.html",
        headers: {
            Origin: 'https://' + D.device.ip(),
            Referer: 'https://' + D.device.ip() + '/userlogin.html'
        },
        form: {
            login: D.device.username(),
            passwd: D.device.password(),
        }
    }, http_config)

    D.device.http.post(config, processResponse(d));
    return d.promise;
}

function getDevice() {
    var d = D.q.defer();
    var config = clone({
        url: "/Device"
    }, http_config)
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

function extractVars(body) {
    var data = JSON.parse(body)
    return [
        D.createVariable("CalendarSyncStatus", "CalendarSyncStatus", data.Device.SchedulingPanel.Monitoring.Scheduling.CalendarSyncStatus),
        D.createVariable("ConnectionStatus", "ConnectionStatus", data.Device.SchedulingPanel.Monitoring.Scheduling.ConnectionStatus),
        D.createVariable("ConnectionStatusMessage", "ConnectionStatusMessage", data.Device.SchedulingPanel.Monitoring.Scheduling.ConnectionStatusMessage),
        D.createVariable("ExchangeRegistrationStatus", "ExchangeRegistrationStatus", data.Device.SchedulingPanel.Monitoring.Scheduling.Exchange.Registration.ExchangeRegistrationStatus),
    ]
}

function validate(){
    login()
        .then(D.success)
}

function get_status() {
    login()
        .then(getDevice)
        .then(extractVars)
        .then(D.success);
}
