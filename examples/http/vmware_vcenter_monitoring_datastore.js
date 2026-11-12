/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring Datastore
 * Description: This script retrieves information about visible datastores in VMware vCenter server
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 7.0.3
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Name: Name of the datastore
 *      - Type: The supported types of vCenter datastores
 *      - Capacity: Capacity of the datastore
 *      - Free Space: Available space of the datastore 
 *      - Usage: The percentage of datastore capacity used
 * 
 **/

var table = D.createTable(
    "Datastores",
    [
        { label: "Name", valueType: D.valueType.STRING },
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Capacity", unit: "GiB",valueType: D.valueType.NUMBER },
        { label: "Free Space", unit: "GiB",valueType: D.valueType.NUMBER }, 
        { label: "Usage", unit: "%",valueType: D.valueType.NUMBER }        
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

// This function retrieves the list of datastores from the VMWare API
function getServices(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/api/vcenter/datastore",
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

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// This function extracts data from the response body and populates the custom table 
function extractData(data) {
    if (data && data.length > 0){
        data.forEach(function(list) {
            if (list.datastore || list.name || list.type || list.capacity || list.free_space){
                var datastore = list.datastore;
                var name = list.name;
                var type = list.type;
                var capacity = parseFloat((list.capacity / Math.pow(1024, 3)).toFixed(2));
                var freeSpace = parseFloat((list.free_space / Math.pow(1024, 3)).toFixed(2));
                var usage = ((capacity - freeSpace) / capacity * 100).toFixed(1);
                var recordId = sanitize(datastore);
                table.insertRecord(recordId, [
                    name,
                    type,
                    capacity,
                    freeSpace,
                    usage
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
        .then(getServices)
        .then(function (response) {
            if (response && response.length > 0) {
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
 * @label Get VMware vCenter Datastore
 * @documentation This procedure is used to retrieve information about VMware vCenter datastores
 */
function get_status() {
    login()
        .then(getServices)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}