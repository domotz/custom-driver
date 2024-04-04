/**
 * Domotz Custom Driver 
 * Name: HPE ILO Components Temperatures
 * Description: Monitors the temperatures of components for HPE Integrated Lights-Out (iLO) systems using the Redfish API
 * 
 * Communication protocol is HTTPS
 * 
 * Tested with HPE iLO 5
 *
 * Creates a Custom Driver table with the following columns:
 *      - Temperature: Component temperature in degrees Celsius
 *      - Status: Health status of the component
 * 
 **/

// Create a Custom Driver table to store Components temperature
var table = D.createTable(
    "Components Temperatures",
    [
        { label: "Temperature", unit: "C", valueType: D.valueType.NUMBER },
        { label: "Status", valueType: D.valueType.STRING }
    ]
);

// Function to make an HTTP GET request to retrieve components temperature from the HPE iLO device
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
    if (data && data.Temperatures) {
        data.Temperatures.forEach(function(entry) {
            if (!entry.Name || !entry.ReadingCelsius == null || !entry.Status || !entry.Status.State) {
                console.error("Missing required properties in the data");
                D.failure(D.errorType.PARSING_ERROR);
            }
            var name = entry.Name;
            var temperature = entry.ReadingCelsius !== null ? entry.ReadingCelsius : "N/A";
            var status = entry.Status.State == "Enabled" ? entry.Status.Health : "N/A";
            var recordId = sanitize(name);
            table.insertRecord(recordId, [
                temperature,
                status
            ]);
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
 * @label Get HPE iLo Components Temperatures
 * @documentation This procedure retrieves components temperature from the HPE iLO device
 */
function get_status() {
    getComponentsTemperatures()
        .then(extractData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}