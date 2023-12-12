/**
 * Domotz Custom Driver 
 * Name: OPNSense Services 
 * Description: This script retrieves a list of services running on an OPNsense firewall, along with their status.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with FreeBSD OPNsense version: 13.2-RELEASE-p5
 *
 * Creates a Custom Driver Variable with the retrieved services names, status, and unique identifiers.
 *
 **/

// The port number
var port = D.getParameter("portNumber");

// Function to make an HTTP GET request to retrieve OPNsense services
function getServices() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/api/core/service/search",
        username: D.device.username(), //api key == username
        password: D.device.password(), //api secret == password
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false

    }, function (error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Function to extract data and create Custom Driver Variable to monitor and display the status of services
function extractData(data) {
    var variables = [];
    data.rows.forEach(function (item) {
        var name = item.name;
        var status = (item.running === 1) ? "running" : "stopped";
        var uid = sanitize(item.id);
        variables.push(D.createVariable(uid, name, status, null, D.valueType.STRING));     
    });
    D.success(variables);
}

/**
 * @remote_procedure
 * @label Validate OPNsense Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    getServices()
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
 * @label Get OPNsense Services
 * @documentation This procedure retrieves OPNsense Services.
 */
function get_status() {
    getServices()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}