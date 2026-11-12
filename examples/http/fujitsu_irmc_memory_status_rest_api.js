/**
 * Domotz Custom Driver 
 * Name: Fujitsu iRMC Memory Status
 * Description: Monitors memory status of a Fujitsu iRMC (Integrated Remote Management Controller) device using the Redfish API
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with Fujitsu iRMC version: S5
 *
 * Creates a Custom Driver table with memory status information
 * 
 **/

// Function to make an HTTP GET request to retrieve memory status from the Fujitsu iRMC device
function getMemoryStatus() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/redfish/v1/Systems/0/Memory?$expand=Members",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        auth: "basic",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
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

// Create a Custom Driver table to store memory status information
var table = D.createTable(
    "Memory Status",
    [                                       
        { label: "Status", valueType: D.valueType.STRING }
    ]
);

// Function to sanitize the record ID 
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response and populates the Custom Driver Table
function extractData(data) {
    data.Members.forEach(function(output){
        if (!output.DeviceLocator || !output.Status || !output.Status.State) {
            console.error("Missing required properties in the data");
        }
        var memorySlot = output.DeviceLocator;
        var status =  (output.Status.State === "Enabled") ? output.Status.Health : "Empty slot";
        var recordId = sanitize(memorySlot);
        table.insertRecord(recordId, [status]);
    });
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate Fujitsu device
 * @documentation This procedure is used to validate the presence of a Fujitsu device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    getMemoryStatus()
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Systems/0/Memory") !== -1) {
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
 * @label Get Fujitsu Memory Status
 * @documentation This procedure retrieves memory status from the Fujitsu iRMC device.
 */
function get_status() {
    getMemoryStatus()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}