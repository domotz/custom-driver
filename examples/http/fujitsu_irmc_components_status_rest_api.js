/**
 * Domotz Custom Driver 
 * Name: Fujitsu iRMC Components Status
 * Description: Monitors the status of each component of the Fujitsu iRMC device using the Redfish API.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with Fujitsu iRMC version: S5
 *
 * Creates a Custom Driver table with the following columns:
 *   - Category: Represents the category of the component
 *   - Status: Represents the status of the component
 * 
 **/

// Function to make an HTTP GET request to retrieve component status from the Fujitsu iRMC device
function getComponentStatus() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/redfish/v1/Chassis/0/Oem/ts_fujitsu/ComponentStatus?$expand=*",
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

// Create a Custom Driver table to store Component status 
var table = D.createTable(
    "Component Status",
    [                                       
        { label: "Category", valueType: D.valueType.STRING },
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
    for (var sensorType in data) {
        var sensors = data[sensorType];
        if (Array.isArray(sensors)) {
            sensors.forEach(function(sensor){
                if (!sensor.Designation || !sensor.EntityId || !sensor.SignalStatus) {
                    console.error("Missing required properties in the data");
                    D.failure(D.errorType.PARSING_ERROR);
                }
                var designation = sensor.Designation;
                var category = sensor.EntityId;
                var status = sensor.SignalStatus === "EmptyOrNotInstalled" ? "Empty Or Not Installed" : sensor.SignalStatus;
                var recordId = sanitize(designation);
                table.insertRecord(recordId, [ category, status ]);
            });
        }
    } 
    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate Fujitsu device
 * @documentation This procedure is used to validate the presence of a Fujitsu device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    getComponentStatus()
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Chassis/0/Oem/ts_fujitsu/ComponentStatus") !== -1) {
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
 * @label Get Fujitsu Components Status
 * @documentation This procedure retrieves component status from the Fujitsu iRMC device.
 */
function get_status() {
    getComponentStatus()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}