/**
 * Domotz Custom Driver 
 * Name: VMWare Monitoring VM Disks
 * Description: This script retrieves information about each disk connected to a Virtual Machine on VMware server 
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 7.0.3
 *
 * Creates a Custom Driver variables:
 *      - Type: Type of disk
 *      - Capacity: Capacity of the disk in gigabytes
 *      - VMDK File: Path to the VMDK file associated with the disk
 * 
 **/

// The ID of the virtual machine
var vmId = D.getParameter("vmId");

// Create a Custom Driver table to store disk information
var table = D.createTable(
    "Disks",[
        { label: "Type", valueType: D.valueType.STRING },
        { label: "Capacity", unit: "GB", valueType: D.valueType.NUMBER },
        { label: "VMDK File", valueType: D.valueType.STRING }
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

// This function retrieves information about disks attached to a specific virtual machine
function getDisks(sessionId) {
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

// This function extracts relevant data from the API response
function extractData(body) {
    if (body && body.disks) {
        for (var diskId in body.disks) {
            var disk = body.disks[diskId];
            if (disk.label || disk.type || disk.capacity || (disk.backing && disk.backing.vmdk_file)) {
                var label = disk.label;
                var type = disk.type;
                var capacity = parseFloat((disk.capacity / Math.pow(1024, 3)).toFixed(2));
                var vmdkFile = disk.backing && disk.backing.vmdk_file;
                var recordId = sanitize(label);
                table.insertRecord(recordId, [
                    type,
                    capacity,
                    vmdkFile
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
        .then(getDisks)
        .then(function (response) {
            if (response && response.disks) {
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
 * @label Get Disks
 * @documentation This procedure is used to retrieve information about disks attached to a specefic virtual machine running on a VMware server
 */
function get_status() {
    login()
        .then(getDisks)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}