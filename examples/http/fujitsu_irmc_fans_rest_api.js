/**
 * Domotz Custom Driver 
 * Name: Fujitsu iRMC Fans
 * Description: Monitors fan status of a Fujitsu iRMC (Integrated Remote Management Controller) device using the Redfish API
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with Fujitsu iRMC version: S5
 *
 * Creates a Custom Driver table with the following columns:
 *      - Speed: Fan speed measured in RPM
 *      - Status: Fan status indicating whether the fan is enabled or disabled
 * 
 **/

// Function to make an HTTP GET request to retrieve fan status from the Fujitsu iRMC device
function getFanStatus() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/redfish/v1/Chassis/0/Thermal",
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

// Function to sanitize the record ID 
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response and populates the Custom Driver Table
function extractData(data) {
    var table = [];
    for (var i = 0; i < data.Fans.length; i++) {
        var output = data.Fans[i];
        var unit = output.ReadingUnits;
        table = D.createTable(
            "Fan Status",
            [                                       
                { label: "Speed", unit: unit, valueType: D.valueType.NUMBER },
                { label: "Status", valueType: D.valueType.STRING }
            ]
        );
    }

    data.Fans.forEach(function(output) {
        if (!output.Name || !output.Reading || !output.ReadingUnits || !output.Status || !output.Status.State) {
            console.error("Missing required properties in the data");
        }
        var name = output.Name;
        var speed = output.Reading;
        var status = output.Status.State === "Enabled" ? output.Status.Health : "Not enabled";
        var recordId = sanitize(name);
        table.insertRecord(recordId, [speed, status]);
    });

    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate Fujitsu device
 * @documentation This procedure is used to validate the presence of a Fujitsu device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    getFanStatus()
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Chassis/0/Thermal") !== -1) {
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
 * @label Get Fujitsu Fan Status
 * @documentation This procedure retrieves fan status from the Fujitsu iRMC device.
 */
function get_status() {
    getFanStatus()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}