/**
 * Domotz Custom Driver 
 * Name: HPE iLO Memory Status
 * Description: Monitors the memory status for HPE Integrated Lights-Out (iLO) systems using the Redfish API
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with HPE iLO 5
 *
 * Creates a Custom Driver table with memory status
 * 
 **/

// Create a Custom Driver table to store memory status
var table = D.createTable(
    "Power Supply",
    [
        { label: "Status", valueType: D.valueType.STRING }
    ]
);

// Function to make an HTTP GET request to retrieve memory status from the HPE iLO device
function getMemoryStatus() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/redfish/v1/Systems/1/Memory?$expand=.",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false

    }, function (error, response, body) {
        if (error) {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
        if (response.statusCode == 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else if (response.statusCode != 200) {
            D.failure(D.errorType.GENERIC_ERROR);
        }
        d.resolve(JSON.parse(body));
    });
    return d.promise;
}

// Function to sanitize the record ID 
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response and populates the Custom Driver Table
function extractData(data) {
    if (data && data.Members) {
        data.Members.forEach(function(entry) {
            if (!entry.DeviceLocator || !entry.Status || !entry.Status.State) {
                console.error("Missing required properties in the data");
            }
            var memorySlot = entry.DeviceLocator;
            var status =  entry.Status.State == "Enabled" ? entry.Status.Health : "Empty slot";
            var recordId = sanitize(memorySlot);
            table.insertRecord(recordId, [status]);
        });
        D.success(table);
    } else {
        console.error("No data available");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate HPE iLo device
 * @documentation This procedure is used to validate the presence of a HPE iLo device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    getMemoryStatus()
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Systems/1/Memory") !== -1) {
                console.info("Data available");
                D.success();
            } else {
                console.error("Desired link not found");
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
 * @label Get HPE iLo Memory Status
 * @documentation This procedure retrieves memory status from the HPE iLO device
 */
function get_status() {
    getMemoryStatus()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}