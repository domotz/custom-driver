/**
 * Domotz Custom Driver 
 * Name: VMWare Monitoring VM Disks
 * Description: This script retrieves information about each disk connected to a Virtual Machine on VMware server 
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vSphere version 7.0.3
 *
 * Creates a Custom Driver variables:
 *      - Type: Type of disk
 *      - Capacity: Capacity of the disk in gigabytes
 *      - VMDK File: Path to the VMDK file associated with the disk
 * 
 **/

// Variable to store the session ID obtained from the VMWare API
var vmwareApiSessionId;

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

// This function retrieves information about disks attached to a specific virtual machine
function getDisks() {
    var d = D.q.defer();
    var config = {
        url: "/rest/vcenter/vm/" + vmId,
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

// Sanitize label to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// This function extracts relevant data from the API response response
function extractData(body) {
    if (body && body.value && body.value.disks && body.value.disks.length > 0) {
        body.value.disks.forEach(function(disk) {
            if (disk.value && (disk.value.label || disk.value.type || disk.value.capacity || (disk.value.backing && disk.value.backing.vmdk_file))) {
                var label = disk.value.label;
                var type = disk.value.type;
                var capacity = parseFloat((disk.value.capacity / Math.pow(1024, 3)).toFixed(2));
                var vmdkFile = disk.value.backing.vmdk_file;
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
        .then(getDisks)
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