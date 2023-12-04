/**
 * Domotz Custom Driver 
 * Name: OPNSense Filter Rules 
 * Description: This script retrieves filter rules data from an OPNsense firewall
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with FreeBSD OPNsense version: 13.2-RELEASE-p5
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Evaluations: Number of evaluations for each filter rule.
 *      - Bytes: Number of bytes for each filter rule.
 *      - States: Number of states for each filter rule.
 *      - States creation: Number of state creations for each filter rule.
 * 
 **/

// ruleName: Set it to 'ALL' to retrieve all filter rules,
// or specify a list of rules to filter and display only the selected rules.
var ruleName = D.getParameter("ruleName");

// Function to make an HTTP GET request to retrieve OPNsense Filter Rules
function getRules() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/api/diagnostics/firewall/pf_statistics/rules",
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

// Custom Driver Table to store filter rules
var table = D.createTable(
    "Filter Rules",
    [
        { label: "Evaluations" },
        { label: "Bytes" },
        { label: "States" },
        { label: "States creation" }
    ]
);

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Function to extract and insert Filter rules data into the custom driver table
function extractData(data) {
    if (data && data.rules && data.rules["filter rules"]) {
        var filterRules = data.rules["filter rules"];
        for (var key in filterRules) {
            if (ruleName[0].toLowerCase() === "all" || ruleName.some(function(name) {
                return (key.toLowerCase().indexOf(name.toLowerCase()) !== -1);
            })) {
                var evaluations = filterRules[key].evaluations;
                var bytes = filterRules[key].bytes;
                var states = filterRules[key].states;
                var stateCreations = filterRules[key].state_creations;
                var recordId = sanitize(key);
                table.insertRecord(recordId, [
                    evaluations,
                    bytes,
                    states,
                    stateCreations
                ]);
            }
        }
        D.success(table);
    } else {
        console.log("No filter rules found");
    }

}

/**
 * @remote_procedure
 * @label Validate OPNsense Device
 * @documentation This procedure is used to validate if data is accessible
 */
function validate(){
    getRules()
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
 * @label Get OPNsense Filter Rules
 * @documentation This procedure retrieves filter rules data from an OPNsense firewall 
 */
function get_status() {
    getRules()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}