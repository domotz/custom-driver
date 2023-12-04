/**
 * Domotz Custom Driver 
 * Name: OPNSense Gateway statistics 
 * Description: This script is designed to retrieve gateway statistics from an OPNsense firewall, providing information such as gateway name, address, status, ping response delay, standard deviation of ping response time, and packet loss percentage.
 *   
 * Communication protocol is HTTPS
 * 
 * Tested with FreeBSD OPNsense version: 13.2-RELEASE-p5
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Address: The IP address of the gateway.
 *      - Status: The status of the gateway. 
 *      - RTT (Round Trip Time): The delay in milliseconds for the ping response to the gateway.
 *      - RTTd (Round Trip Time Deviation): The standard deviation in milliseconds of the ping response time.
 *      - Loss: The packet loss percentage in the ping response. 
 *
 **/

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
    }, function (error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
        if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        }
        if (response.statusCode != 200) {
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
        { label: "Address" },
        { label: "Status" },
        { label: "RTT", unit: "ms" },
        { label: "RTTd", unit: "ms" },
        { label: "Loss", unit: "%" }
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
        var rtt = item.stddev.replace(/[^\d,.]/g, "");
        var rttd = item.delay.replace(/[^\d,.]/g, "");
        var loss = item.loss.replace(/[^\d,.]/g, "");
        var recordId = sanitize(name)
        table.insertRecord(recordId, [
            address,
            status,
            rtt,
            rttd,
            loss
        ]);
    });
    D.success(table)
}

/**
 * @remote_procedure
 * @label Validate OPNsense Device
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