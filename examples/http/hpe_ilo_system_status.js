/**
 * Domotz Custom Driver 
 * Name: HPE ILO System status
 * Description: Monitors the status for HPE ILO (Integrated Lights-Out) systems using the Redfish API
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with HPE iLO 5
 *
 * Creates a Custom Driver table with system status information
 * 
 **/

// Function to make an HTTP POST request to retrieve status from the HPE iLO device
function getSystemStatus() {
    var d = D.q.defer();
    var payload = {
        "Select": [{
            "From": "/Systems/1/",
            "Properties": ["Oem.Hpe.AggregateHealthStatus as Health", "PowerState AS PowerState", "Oem.Hpe.PostState as PostState"]
        }]
    };
    D.device.http.post({
        url: "/redfish/v1/Views",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false,
        body: JSON.stringify(payload),
        headers: {
            "Content-Type":"application/json"
        }
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

// Create a Custom Driver table to store system status information
var table = D.createTable(
    "System status",
    [
        {label: "Status", valueType: D.valueType.STRING}
    ]
);

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response and populates the Custom Driver Table
function extractData(data) {
    if (!data) {
        console.error("Data is not available");
        D.failure(D.errorType.GENERIC_ERROR);
    }
    var systemStatus = [];
    Object.keys(data.Health).forEach(function(healthKey) {
        var healthData = data.Health[healthKey];
        if (typeof healthData === "object") {
            Object.keys(healthData.Status).forEach(function(statusKey) {
                systemStatus.push({
                    id: healthKey,
                    status: healthData.Status[statusKey]
                });
            });
            if (healthData.PowerSuppliesMismatch !== undefined) {
                systemStatus.push({
                    id: "PowerSuppliesMismatch",
                    status: healthData.PowerSuppliesMismatch
                });
            }
        } else {
            systemStatus.push({
                id: healthKey,
                status: healthData
            });
        }
    });
    Object.keys(data).forEach(function(key) {
        if (key !== "Health") {
            systemStatus.push({
                id: key,
                status: data[key]
            });
        }
    });

    systemStatus.forEach(function(status) {
        var recordId = status.id.replace(/([a-z])([A-Z])/g, '$1-$2');
        table.insertRecord(sanitize(recordId), [status.status]);
    });

    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate HPE iLo device
 * @documentation This procedure is used to validate the presence of a HPE iLo device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    getSystemStatus()
        .then(function (response) {
            if (response) {
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
 * @label Get HPE iLo Status
 * @documentation This procedure retrieves status from the HPE iLO device
 */
function get_status() {
    getSystemStatus()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}