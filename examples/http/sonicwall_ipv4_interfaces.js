/**
 * Domotz Custom Driver 
 * Name: Sonicwall - IPV4 Interfaces
 * Description: Monitors Sonicwall device interfaces and provides details for each interface. 
 * 
 * Specify which interfaces to monitor based on the provided interfaceName parameter.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL TZ 270 SonicOS version 7.0.1
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Ip Address: IP address and subnet mask
 *      - Gateway: Gateway IP
 *      - Zone: Zone for the interface
 *      - User Login: Login information for the interface
 *      - Management: Management information for the interface
 * 
 **/

// interface_name set it to 'ALL' to retrieve all interfaces,
// or specify a list of interface names to filter and display only the selected interfaces 
var interface_name = D.getParameter('interfaceName');

var table = D.createTable(
    "Interfaces", [
        { label: "Ip Address" },
        { label: "Gateway" },
        { label: "Zone" },
        { label: "User Login" },
        { label: "Management" }
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

//Retrieves IPv4 interafces from the SonicWALL device
function getInterfaces() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/interfaces/ipv4",
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
    data.interfaces.forEach(function (item) {
        var name = item.ipv4.name.toLowerCase();
        if (interface_name[0].toLowerCase() === "all" || interface_name.indexOf(name) !== -1) {
            var comment = item.ipv4.comment;
            var recordId = sanitize(comment ? name + "-" + comment : name);
            var ipAssignmentMode = item.ipv4.ip_assignment.mode;
            var ip = ipAssignmentMode.static && ipAssignmentMode.static.ip || "";
            var netmask = ipAssignmentMode.static && ipAssignmentMode.static.netmask || "";
            var ipAddress = ip + " - " + netmask;
            var gateway = ipAssignmentMode.static && ipAssignmentMode.static.gateway || "-";
            var zone = item.ipv4.ip_assignment.zone || "-";
            var userLogin = extractValue(item.ipv4.user_login) || "-";
            var management = extractValue(item.ipv4.management) || "-";
            table.insertRecord(recordId, [
                ipAddress,
                gateway,
                zone,
                userLogin,
                management
            ]);
        }
    });

    D.success(table);
}

function extractValue(data) {
    if (typeof data === "object") {
        var formattedField = Object.keys(data).map(function (key) {
            return key + ' : ' + data[key] || "-";
        }).join(' | ');
        return formattedField;
    }
    return data;
}

/**
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate(){
    login()
        .then(getInterfaces)
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
 * @label Get IPv4 interfaces
 * @documentation This procedure is used to retrieve IPv4 interfaces from the SonicWALL device and populate the custom table.
 */
function get_status() {
    login()
        .then(getInterfaces)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}