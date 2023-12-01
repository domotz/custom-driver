/**
 * Domotz Custom Driver 
 * Name: OPNSense Nat Rules 
 * Description: This script retrieves NAT rules data from an OPNsense firewall
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with FreeBSD OPNsense version: 13.2-RELEASE-p5
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Evaluations: Number of evaluations for each NAT rule.
 *      - Bytes: Number of bytes for each NAT rule.
 *      - States: Number of states for each NAT rule.
 *      - States creation: Number of state creations for each NAT rule.
 * 
 **/

// ruleName: Set it to 'ALL' to retrieve all NAT rules,
// or specify a list of rules to filter and display only the selected rules.
var ruleName = D.getParameter("ruleName");


// Function to make an HTTP GET request to retrieve OPNSense Nat Rules
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

// Custom Driver Table to store nat rules
var table = D.createTable(
    "Nat Rules",
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

// Function to extract and insert NAT rules data into the custom driver table
function extractData(data) {
    if (data && data.rules && data.rules["nat rules"]) {
        var natRules = data.rules["nat rules"];
        for (var key in natRules) {
            if (ruleName[0].toLowerCase() === "all" || ruleName.some(function(name) {
                return (key.toLowerCase().indexOf(name.toLowerCase()) !== -1);
            })) {
                var evaluations = natRules[key].evaluations;
                var bytes = natRules[key].bytes;
                var states = natRules[key].states;
                var stateCreations = natRules[key].state_creations;
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
        console.log("No nat rules found");
    }

}

/**
 * @remote_procedure
 * @label Validate OPENSense Device
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
 * @label Get OPENSense Nat Rules
 * @documentation This procedure retrieves NAT rules data from an OPNsense firewall
 */
function get_status() {
    getRules()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}