/**
 * Domotz Custom Driver 
 * Name: VMWare Monitoring VM list
 * Description: Diplays a list of all the VMs and their properties in a VMWare server
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 7.0.3
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Name: Name of the Virtual machine
 *      - Memory: Memory size in Gigabytes
 *      - CPU count: The number of CPU cores
 *      - Power state: The valid power states for a virtual machine
 * 
 **/

// Create a Custom Driver table to store VM List info
var table = D.createTable(
    "Virtual Machines List",
    [
        { label: "Name", valueType: D.valueType.STRING },
        { label: "Memory", unit: "GB", valueType: D.valueType.NUMBER },
        { label: "CPU count", valueType: D.valueType.NUMBER },
        { label: "Power state", valueType: D.valueType.STRING }
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

// This function retrieves the list of virtual machines from the VMWare API
function getVMList(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/api/vcenter/vm",
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

// Sanitize VM ID to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// This function extracts data from the response body and populates the custom table 
function extractData(body) {
    if (body && body.length > 0){
        body.forEach(function(list) {
            if (list.vm || list.name || list.memory_size_MiB || list.cpu_count || list.power_state){
                var vmiId = list.vm;
                var name = list.name;
                var memory = list.memory_size_MiB / 1024;
                var cpuCount = list.cpu_count;
                var powerStat = list.power_state;
                var recordId = sanitize(vmiId);
                table.insertRecord(recordId, [
                    name,
                    memory,
                    cpuCount,
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
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare device
 */
function validate(){
    login()
        .then(getVMList)
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
 * @label Get Virtual Machines List 
 * @documentation TThis procedure is used to retrieve to retrieve the status of Virtual Machines from VMWare device
 */
function get_status() {
    login()
        .then(getVMList)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}