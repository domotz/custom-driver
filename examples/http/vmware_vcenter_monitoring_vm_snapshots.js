/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring VM Snapshots
 * Description: This script retrieves information about the latest snapshot taken on a VMware vCenter virtual machines. It allows monitoring of snapshot creation time and age
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 8.0.2
 *
 * Creates Custom Driver variables:
 *      - ID: The identifier for the latest snapshot 
 *      - Name: The name of the latest snapshot
 *      - Description: A description of the latest snapshot
 *      - Creation time: The date and time when the latest snapshot was created
 *      - Age: The age of the latest snapshot in days
 * 
 **/

// The ID of the virtual machine
var vmId = D.getParameter("vmId");

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
        } else {
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

/**
 * Recursively finds the latest snapshot
 * @param {object} snapshot Snapshot object
 * @returns The latest snapshot
 */
function findLatestSnapshot(snapshot) {
    var latestSnapshot = snapshot;
    var latestTime = new Date(snapshot.createTime);
    if (snapshot.childSnapshotList && snapshot.childSnapshotList.length > 0) {
        snapshot.childSnapshotList.forEach(function(childSnapshot) {
            var latestChildSnapshot = findLatestSnapshot(childSnapshot);
            if (latestChildSnapshot) {
                var childTime = new Date(latestChildSnapshot.createTime);
                if (childTime > latestTime) {
                    latestSnapshot = latestChildSnapshot;
                    latestTime = childTime;
                }
            }
        });
    }
    return latestSnapshot;
}

// Convert time from AM/PM to 24 hours
function convertTo24Hour(time12h) {
    var time = time12h.split(/:| /);
    var hours = parseInt(time[0]);
    var minutes = time[1];
    var seconds = time[2];
    var ampm = time[3]; 
    if (ampm === "AM" && hours === 12) {
        hours = 0;
    } else if (ampm === "PM" && hours < 12) {
        hours += 12;
    }
    return hours + ":" + minutes + ":" + seconds;
}

//Extracts relevant data from the snapshot object
function extractData(data) {
    if (data && data.rootSnapshotList && data.rootSnapshotList.length > 0) {
        var latestSnapshot = null;
        data.rootSnapshotList.forEach(function(snapshot) {
            var latest = findLatestSnapshot(snapshot);
            if (!latestSnapshot || !latest || new Date(latest.createTime) > new Date(latestSnapshot.createTime)) {
                latestSnapshot = latest;
            }
        });

        if (latestSnapshot) {
            var id = latestSnapshot.snapshot.value || "N/A";
            var name = latestSnapshot.name || "N/A";
            var nameRegex = name.match(/^(.*?)\b(\d{1,2}\/\d{1,2}\/\d{4}, \d{1,2}:\d{2}:\d{2} (?:AM|PM))/);
            var snapshotName = nameRegex[1].trim();
            var snapshotDateTime = nameRegex[2];
            var timeMatch = snapshotDateTime.split(", ");
            var time12h = timeMatch[1];
            var time24h = convertTo24Hour(time12h);
            var snapshot = snapshotName + " " + timeMatch[0] + " " + time24h; 
           
            var description = latestSnapshot.description || "N/A";
            var createTime = latestSnapshot.createTime;
            var date = new Date(createTime);
            var timeCreated =
                (date.getUTCMonth() + 1 < 10 ? "0" : "") + (date.getUTCMonth() + 1) + "/" +
                (date.getUTCDate() < 10 ? "0" : "") + date.getUTCDate() + "/" +
                date.getUTCFullYear() + " " +
                (date.getUTCHours() < 10 ? "0" : "") + date.getUTCHours() + ":" +
                (date.getUTCMinutes() < 10 ? "0" : "") + date.getUTCMinutes() + ":" +
                (date.getUTCSeconds() < 10 ? "0" : "") + date.getUTCSeconds() + " UTC";

            var currentDate = new Date();
            var ageInMilliseconds = currentDate - date;
            var ageInDays = Math.floor(ageInMilliseconds / (1000 * 60 * 60 * 24));

            var variables = [
                D.createVariable("id", "ID", id, null, D.valueType.STRING),
                D.createVariable("name", "Name", snapshot, null, D.valueType.STRING),
                D.createVariable("description", "Description", description, null, D.valueType.STRING),
                D.createVariable("creation-time", "Creation Time", timeCreated, null, D.valueType.DATETIME),
                D.createVariable("age", "Age", ageInDays, "Days", D.valueType.NUMBER)
            ];
            D.success(variables);
        } else {
            console.error("Latest snapshot not found");
            D.failure(D.errorType.PARSING_ERROR);
        }
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
 * @label Get VMware vCenter latest snapshot info
 * @documentation This procedure retrieves detailed information about the latest snapshot taken on a specific VMware vCenter virtual machine
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