/**
 * Domotz Custom Driver 
 * Name: HPE ILO Fans 
 * Description: Monitors the fan status of HPE Integrated Lights-Out (iLO) systems using the Redfish API
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with HPE iLO 5
 *
 * Creates a Custom Driver table with the following columns:
 *      - Speed: Fan speed 
 *      - Status: Fan status indicating whether the fan is enabled or not enabled
 * 
 **/

// Function to make an HTTP GET request to retrieve fan status from the HPE iLO device
function getComponentsTemperatures() {
    var d = D.q.defer();
    D.device.http.get({
        url: "/redfish/v1/Chassis/1/Thermal",
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

// Sanitize name to create a recordId
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Extracts relevant data from the API response and populates the Custom Driver Table
function extractData(data) {
    if (!data.Fans || data.Fans.length === 0) {
        console.error("No fan data available");
        D.failure(D.errorType.GENERIC_ERROR);
    }

    var unit = data.Fans[0].ReadingUnits;
    if (unit == "Percent"){
        unit = "%";
    }
    var table = D.createTable(
        "Fan Status",
        [
            { label: "Speed", unit: unit, valueType: D.valueType.NUMBER },
            { label: "Status", valueType: D.valueType.STRING }
        ]
    );

    data.Fans.forEach(function(output) {
        if (!output.Name || !output.Reading || !output.Status || !output.Status.State) {
            console.error("Missing required properties in the data");
            D.failure(D.errorType.PARSING_ERROR);
        }
        var name = output.Name;
        var speed = output.Reading;
        var status = output.Status.State == "Enabled" ? output.Status.Health : "Not enabled";
        var recordId = sanitize(name);
        table.insertRecord(recordId, [speed, status]);
    });

    D.success(table);
}

/**
 * @remote_procedure
 * @label Validate HPE iLo device
 * @documentation This procedure is used to validate the presence of a HPE iLo device by checking the availability of a specific Redfish API endpoint
 */
function validate(){
    getComponentsTemperatures()
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Chassis/1/Thermal") !== -1) {
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
 * @label Get HPE iLo Fan Status
 * @documentation This procedure retrieves fan status from the HPE iLO device
 */
function get_status() {
    getComponentsTemperatures()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}