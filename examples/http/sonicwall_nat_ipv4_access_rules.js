/**
 * Domotz Custom Driver 
 * Name: Sonicwall - NAT IPV4 Access Rules
 * Description: Monitors IPv4 access rules for Sonicwall devices
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on SonicWALL TZ 270 SonicOS version 7.0.1
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Description: Description of the access rule
 *      - Enabled: Indicates whether the access rule is enabled or not
 *      - From: Specifies the source IP or network range
 *      - To: Specifies the destination IP or network range
 *      - Source: Defines the source IP or network for the traffic
 *      - Destination: Specifies the destination IP or network for the traffic
 *      - Action: Describes the action associated with the access rule
 * 
 **/

// access_rule_name: Set it to 'ALL' to retrieve all access rules,
// or specify a list of access rules to filter and display only the selected access rules.
var access_rule_name = D.getParameter('accessRuleName');

var table = D.createTable(
    "Access Rules", [
        { label: "Description" },
        { label: "Enabled" },
        { label: "From" },
        { label: "To" },
        { label: "Source" },
        { label: "Destination" },
        { label: "Action" }
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

//Retrieves IPv4 Access Rules from the SonicWALL device
function getAccessRules() {
    var d = D.q.defer();
    var config = {
        url: "/api/sonicos/access-rules/ipv4",
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
    data.access_rules.forEach(function (item) {
        var name = item.ipv4.name;
        var uuid = item.ipv4.uuid;
        if (access_rule_name[0].toLowerCase() === "all" || access_rule_name.some(function(res) {
            return res.toLowerCase() === name.toLowerCase();
        })) {      
            var recordId = sanitize(name + "-" + uuid);
            var description = item.ipv4.comment || "-";
            var enabled;
            if (item.ipv4.enable === true || item.ipv4.enable === "true") {
                enabled = "Yes";
            } else if (item.ipv4.enable === false || item.ipv4.enable === "false") {
                enabled = "No";
            }                   
            var from = item.ipv4.from;
            var to = item.ipv4.to;
            var sourceAddress = "Address: (" + extractValue(item.ipv4.source.address) + ")";
            var sourcePort = "Port: (" + extractValue(item.ipv4.source.port) + ")";
            var source = sourceAddress + " | " + sourcePort;
            var destination = "Address: (" + extractValue(item.ipv4.destination.address) + ")";
            var action = item.ipv4.action;
            table.insertRecord(recordId, [
                description,
                enabled,
                from,
                to,
                source.replace(/true/g, "Yes").replace(/false/g, "No"),
                destination.replace(/true/g, "Yes").replace(/false/g, "No"),
                action
            ]);
        }
    });
    D.success(table);
}

function extractValue(field) {
    if (typeof field === "object") {
        var keys = Object.keys(field);
        console.log(field[keys]);
        return keys + ": " + field[keys];
    }
    return field;
}

/**
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the SonicWALL device.
 */
function validate(){
    login()
        .then(getAccessRules)
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
 * @label Get IPv4 Access Rules
 * @documentation This procedure is used to retrieve IPv4 access rules from the SonicWALL device and populate the custom table.
 */
function get_status() {
    login()
        .then(getAccessRules)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}