/**
 * Domotz Custom Driver 
 * Name: VMWare Monitoring Host List
 * Description: This script retrieves list of hosts in a VMWare server
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vSphere version 7.0.3
 *
 * Creates a Custom Driver variables:
 *      - Name: Name of the host
 *      - Connection State: The connection status of a host
 *      - Power State: The power states of a host
 * 
 **/

// Variable to store the session ID obtained from the VMWare API
var vmwareApiSessionId;

// Create a Custom Driver table to store disk information
var table = D.createTable(
    "Hosts List",[
        { label: "Name", valueType: D.valueType.STRING },
        { label: "Connection State", valueType: D.valueType.STRING },
        { label: "Power State", valueType: D.valueType.STRING }
    ]
);

// This function processes the response from HTTP requests
function processResponse(d) {
    return function process(error, response, body) {
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401 || response.statusCode === 403) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        var responseBody = JSON.parse(response.body);
        vmwareApiSessionId = responseBody.value; 
        d.resolve(JSON.parse(body));
    };
}

// This function performs login to obtain a session ID from the VMWare API
function login() {
    var d = D.q.defer();
    var config = {
        url: "/rest/com/vmware/cis/session",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, processResponse(d));
    return d.promise;
}

// This function retrieves the list of hosts from the VMWare API
function getHostList() {
    var d = D.q.defer();
    var config = {
        url: "/rest/vcenter/host",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            "vmware-api-session-id": vmwareApiSessionId 
        }
    };
    D.device.http.get(config, processResponse(d));
    return d.promise;
}

// Sanitize host value to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// This function extracts relevant data from the API response response
function extractData(body) {
    if (body && body.value && body.value.length > 0){
        body.value.forEach(function(hostList) {
            if (hostList.host || hostList.name || hostList.connection_state || hostList.power_state){
                var host = hostList.host;
                var name = hostList.name;
                var connectionState = hostList.connection_state;
                var powerStat = hostList.power_state;
                var recordId = sanitize(host);
                table.insertRecord(recordId, [
                    name,
                    connectionState,
                    powerStat
                ]);
            } else {
                console.error("Missing required properties in the data");
                D.failure(D.errorType.PARSING_ERROR);
            }
        });
        D.success(table);
    } else {
        console.error("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare device
 */
function validate(){
    login()
        .then(getHostList)
        .then(function (response) {
            if (response && response.value) {
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
 * @label Get Hosts List
 * @documentation  TThis procedure is used to retrieve the list of hosts from VMWare device
 */
function get_status() {
    login()
        .then(getHostList)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}