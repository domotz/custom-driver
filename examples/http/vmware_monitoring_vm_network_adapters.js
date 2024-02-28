/**
 * Domotz Custom Driver 
 * Name: VMWare Monitoring VM Network adapters
 * Description: This script retrieves information about each network adapter connected to a Virtual Machine on VMware server 
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 7.0.3
 *
 * Creates a Custom Driver variables:
 *      - Network: Network information
 *      - Network name: Network name
 *      - MAC: MAC address
 *      - State: Network adapter state
 * 
 **/

// The ID of the virtual machine
var vmId = D.getParameter("vmId");

// Create a Custom Driver table to store network adapter information
var table = D.createTable(
    "Disks",[
        { label: "Network", valueType: D.valueType.STRING },
        { label: "Network name", valueType: D.valueType.STRING },
        { label: "MAC", valueType: D.valueType.STRING },
        { label: "State", valueType: D.valueType.STRING }
    ]
);

// Logs in to the VMWare device using basic authentication.
function login() {
    var d = D.q.defer();
    var config = {
        url: "/api/session",
        username: D.device.username(),
        password: D.device.password(),
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false
    };
    D.device.http.post(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 201) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// This function retrieves information about network adapetrs attached to a specific virtual machine
function getNetworkAdapters(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/api/vcenter/vm/" + vmId,
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            "vmware-api-session-id": sessionId 
        }
    };
    D.device.http.get(config, function(error, response, body){
        if (error) {          
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        } else if (response.statusCode == 404) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        } 
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// Sanitize label to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// This function extracts relevant data from the API response response
function extractData(body) {
    if (body && body.nics) {
        for (var nicId in body.nics) {
            var nic = body.nics[nicId];
            if (nic.label || (nic.backing && nic.backing.network) || nic.backing.network_name || nic.mac_address || nic.state ) {
                var label = nic.label;
                var network = nic.backing.network;
                var networkName = nic.backing.network_name;
                var macAddress = nic.mac_address; 
                var state = nic.state;
                var recordId = sanitize(label);
                table.insertRecord(recordId, [
                    network,
                    networkName,
                    macAddress,
                    state
                ]);
            } else {
                console.error("Missing required properties in the data");
                D.failure(D.errorType.PARSING_ERROR);
            }
        }
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
        .then(getNetworkAdapters)
        .then(function (response) {
            if (response && response.nics) {
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
 * @label Get Network Adapters
 * @documentation This procedure is used to retrieve information about network adapters attached to a specific virtual machine running on a VMware server
 */
function get_status() {
    login()
        .then(getNetworkAdapters)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}