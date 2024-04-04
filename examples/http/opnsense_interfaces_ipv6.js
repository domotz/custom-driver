/**
 * Domotz Custom Driver 
 * Name: OPNSense Interfaces Stats IPV6
 * Description: This script is designed for retrieving IPv6 interface statistics from an OPNsense firewall.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with FreeBSD OPNsense version: 13.2-RELEASE-p5
 *
 * Creates a Custom Driver Table with the following columns:
 *      - References Number: The number of references or connections associated with the interface
 *      - In traffic (ipv6 block): The amount of incoming IPv6 traffic that was blocked by the firewall
 *      - In traffic (ipv6 pass): The amount of incoming IPv6 traffic that was allowed or passed by the firewall
 *      - Out traffic (ipv6 block): The amount of outgoing IPv6 traffic that was blocked by the firewall
 *      - Out traffic (ipv6 pass): The amount of outgoing IPv6 traffic that was allowed or passed by the firewall
 *      - Cleared Time: The timestamp when the statistics were last cleared or reset
 * 
 **/

// interfaceName: Set it to 'ALL' to retrieve all interfaces,
// or specify a list of interfaces to filter and display only the selected interfaces.
var interfaceName = D.getParameter("interfaceName");

// The port number
var port = D.getParameter("portNumber");

// Custom Driver Table to store IPv6 Interface Statistics
var table = D.createTable(
    "Interfaces IPV6",
    [
        { label: "References Number", valueType: D.valueType.NUMBER },
        { label: "In traffic (ipv6 block)", unit: "B", valueType: D.valueType.NUMBER },
        { label: "In traffic (ipv6 pass)", unit: "B", valueType: D.valueType.NUMBER },
        { label: "Out traffic (ipv6 block)", unit: "B", valueType: D.valueType.NUMBER },
        { label: "Out traffic (ipv6 pass)", unit: "B", valueType: D.valueType.NUMBER },
        { label: "Cleared Time", valueType: D.valueType.DATETIME }
    ]
);

// Function to make an HTTP GET request to retrieve OPNsense Interfaces Stats for IPv6
function getInterfaces() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/api/diagnostics/firewall/pf_statistics/interfaces",
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

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Function to extract and insert Interfaces Stats data into the custom driver table for IPv6
function extractData(data) {
    for (var interface in data.interfaces) {
        if (interface !== "all"){
            if (interfaceName[0].toLowerCase() === "all" || interfaceName.some(function(name) {
                return (interface.toLowerCase().indexOf(name.toLowerCase()) !== -1);
            })) { 
                var recordId = sanitize(interface);
                var references = data.interfaces[interface].references;
                var in6BlockBytes = data.interfaces[interface].in6_block_bytes;
                var in6PassBytes = data.interfaces[interface].in6_pass_bytes;
                var out6BlockBytes = data.interfaces[interface].out6_block_bytes;
                var out6PassBytes = data.interfaces[interface].out6_pass_bytes;
                var cleared = data.interfaces[interface].cleared;
                table.insertRecord(recordId, [
                    references,
                    in6BlockBytes,
                    in6PassBytes,
                    out6BlockBytes,
                    out6PassBytes,
                    cleared
                ]);
            }
        }
    }
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate OPNsense Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    getInterfaces()
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
 * @label Get OPNsense Interfaces Stats for IPv6
 * @documentation This procedure retrieves Interfaces Stats data from an OPNsense firewall for IPv6
 */
function get_status() {
    getInterfaces()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}