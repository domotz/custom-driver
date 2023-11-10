/**
 * Domotz Custom Driver 
 * Name: Sonicwall - VPN Stats info
 * Description: Monitors VPN sessions for Sonicwall devices and populates a custom table with session information
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL TZ 270 SonicOS version 7.0.1
 *
 * Creates a Custom Driver Table with the following columns:
 *      - ID: Username of the VPN session
 *      - Local IP Address: Local IP address of the VPN session
 *      - Remote IP Address: Remote IP address of the VPN session
 *      - Logged in: Timestamp when the user logged in to the VPN session
 * 
 **/

var table = D.createTable(
    "VPN Sessions", [
        { label: "Local IP Address" },
        { label: "Remote IP Address" },
        { label: "Logged in" }
    ]
);

//Processes the HTTP response and handles errors
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
 * Logs in to the SonicWALL device using basic authentication.
 * @returns A promise that resolves on successful login.
 */
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/auth",
        username: D.device.username(),
        password: D.device.password(),
        port: 8444,
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

// Retrieves VPN Sessions data from the SonicWALL device.
function getVpnSessions() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/reporting/ssl-vpn/sessions",
        protocol: "https",
        port: 8444,
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

//Extracts data from the HTTP response and populates the custom table.
function extractData(body) {
    var data = JSON.parse(body);
    for (var i = 0; i < data.length; i++) {
        var session = data[i];
        var recordId = sanitize(session.user_name); 
        table.insertRecord(recordId, [
            session.client_virtual_ip,
            session.client_wan_ip,
            session.logged_in
        ]);
    }
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate Connection
 * @documentation This procedure is used to validate the connection and retrieve VPN session data from the SonicWALL device.
 */
function validate(){
    login()
        .then(getVpnSessions)
        .then(function (response) {
            if (response) {
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
 * @label Get VPN Sessions
 * @documentation This procedure is used to retrieve VPN session data from the SonicWALL device and populate the custom table.
 */
function get_status() {
    login()
        .then(getVpnSessions)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}