/**
 * Domotz Custom Driver 
 * Name: OPNSense Gateway statistics 
 * Description: This script is designed to retrieve gateway statistics from an OPNsense firewall, providing information such as gateway name, address, status, ping response delay and packet loss percentage.
 *   
 * Communication protocol is HTTPS
 * 
 * Tested with FreeBSD OPNsense version: 13.2-RELEASE-p5
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Address: The IP address of the gateway.
 *      - Status: The status of the gateway. 
 *      - RTTsd (Round Trip Time): The delay in milliseconds for the ping response to the gateway.
 *      - Loss: The packet loss percentage in the ping response. 
 *
 **/

// The port number
var port = D.getParameter("portNumber");

//Function to make an HTTP POST request to retrieve OPNsense gateway statistics
function gatewayStats() {
    var d = D.q.defer();
    D.device.http.post({
        url: "/api/routes/gateway/status",
        username: D.device.username(), //api key == username
        password: D.device.password(), //api secret == password
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false,
        port: port
        
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

// Custom Driver Table to store gateway statistics
var table = D.createTable(
    "Gateway Statistics",
    [
        { label: "Address", valueType: D.valueType.STRING },
        { label: "Status", valueType: D.valueType.STRING },
        { label: "RTTsd", unit: "ms", valueType: D.valueType.NUMBER },
        { label: "Loss", unit: "%", valueType: D.valueType.NUMBER }
    ]
);

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response and populates the Custom Driver Table.
function extractData(data) {
    data.items.forEach(function (item) {
        var name = item.name;
        var address = item.address;
        var status = item.status_translated
        var rttsd = item.stddev.replace(/[^\d,.]/g, "");
        var loss = item.loss.replace(/[^\d,.]/g, "");
        var recordId = sanitize(name)
        table.insertRecord(recordId, [
            address,
            status,
            rttsd,
            loss
        ]);
    });
    D.success(table)
}

/**
 * @remote_procedure
 * @label Validate OPENSense Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    gatewayStats()
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
 * @label Get OPNsense Gateway Statistics
 * @documentation  This procedure retrieves OPNsense gateway statistics.
 */
function get_status() {
    gatewayStats()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}