/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring VM Snapshots
 * Description: This script retrieves information about snapshots taken on a VMware vCenter virtual machines. It allows monitoring of snapshot creation time and age
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 8.0.2
 *
 * Creates a Custom Driver Table with the following columns:
 *      - Name: The name of the snapshot
 *      - Description: A description of the snapshot
 *      - Creation time: The date and time when the snapshot was created
 *      - Age: The age of the snapshot in days
 * 
 **/

// The ID of the virtual machine
var vmId = D.getParameter("vmId");

// Table to store snapshot information
var table = D.createTable(
    "Snapshots",
    [
        { label: "Name", valueType: D.valueType.STRING },
        { label: "Description", valueType: D.valueType.STRING },
        { label: "Creation time", valueType: D.valueType.DATETIME },
        { label: "Age", unit: "Days", valueType: D.valueType.NUMBER }      
    ]
);

// Function to handle the login procedure
function login() {
    var d = D.q.defer();
    var config = {
        url: "/sdk/vim25/8.0.1.0/SessionManager/SessionManager/Login",
        protocol: "https",
        jar: true,
        rejectUnauthorized: false,
        body: JSON.stringify({
            "userName": D.device.username(),
            "password": D.device.password() 
        })
    };
    D.device.http.post(config, function(error, response){
        if (error) {  
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);                     
        } else {
            if (response.body && response.body.indexOf("InvalidLogin") !== -1) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            }
            if (response.body && response.body.indexOf("InvalidRequest") !== -1) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            var sessionId = response.headers["vmware-api-session-id"];
            d.resolve(sessionId);
        }         
    });
    return d.promise;
}

// This function retrieves snapshot information for the VM
function getVMSnapshots(sessionId) {
    var d = D.q.defer();
    var config = {
        url: "/sdk/vim25/8.0.1.0/VirtualMachine/" + vmId + "/snapshot",
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
        } else  {
            if (response.body && response.body.indexOf("InvalidType") !== -1) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            if (response.body && response.body.indexOf("already been deleted or has not been completely created") !== -1) {
                console.error("The " + vmId + " has already been deleted or has not been completely created");
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            }
            if (body && body.length > 0) {
                d.resolve(JSON.parse(body));
            } else {
                console.error("No snapshot data available for VM " + vmId);
                D.failure(D.errorType.PARSING_ERROR);
            }
        } 
    });
    return d.promise;
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// This function extracts snapshot data from the response body  
function extractData(data) {
    if (data && data.rootSnapshotList && data.rootSnapshotList.length > 0){
        data.rootSnapshotList.forEach(function(snapshot) {
            if (snapshot.name || snapshot.description || snapshot.createTime){
                var name = snapshot.name;
                var descriptione = snapshot.description;
                var createTime = snapshot.createTime;
                var date = new Date(createTime);
                var formattedCretaeTime =
                    (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate() + ":" +
                    (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1) + ":" +
                    date.getUTCFullYear() + " " +
                    (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours() + ":" +
                    (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes() + ":" +
                    (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds();
            
                var currentDate = new Date(); 
                var ageInMilliseconds = currentDate - date;
                var ageInDays = (ageInMilliseconds / (1000 * 60 * 60 * 24)); 
                var recordId = sanitize(snapshot.snapshot.value);
                table.insertRecord(recordId, [
                    name,
                    descriptione,
                    formattedCretaeTime,
                    ageInDays
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
        .then(getVMSnapshots)
        .then(function (response) {
            if (response && response.rootSnapshotList && response.rootSnapshotList.length > 0) {
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
 * @label Get VMware vCenter Snapshot info
 * @documentation This procedure retrieves detailed information about snapshots taken on a specific VMware vCenter virtual machines
 */
function get_status() {
    login()
        .then(getVMSnapshots)
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}