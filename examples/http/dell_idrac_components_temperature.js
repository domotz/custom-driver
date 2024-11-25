/**
 * Domotz Custom Driver 
 * Name: Dell iDrac - Components Temperature
 * Description: Monitors component temperature of a DELL iDRAC device using the Redfish API
 * 
 * Communication protocol is HTTPS
 * 
 * Tested under iDRAC version: 2.86.86.86
 *
 * Creates a Custom Driver table with the following columns:
 *      - Status: Current health status of the component
 *      - Reading: The current temperature reading of the component in Celsius
 *      - Min Warning Threshold: The minimum temperature threshold for warnings
 *      - Max Warning Threshold: The maximum temperature threshold for warnings
 *      - Min Critical Threshold: The minimum temperature threshold for critical warnings
 *      - Max Critical Threshold: The maximum temperature threshold for critical warnings
 * 
 **/

const table = D.createTable(
    "Component Temperature",
    [              
        { label: "Status ", valueType: D.valueType.STRING },
        { label: "Reading", unit: "C", valueType: D.valueType.NUMBER },
        { label: "Min Warning Threshold", unit: "C", valueType: D.valueType.NUMBER },
        { label: "Max Warning Threshold", unit: "C", valueType: D.valueType.NUMBER },
        { label: "Min Critical Threshold", unit: "C", valueType: D.valueType.NUMBER },
        { label: "Max Critical Threshold", unit: "C", valueType: D.valueType.NUMBER }
    ]
)

/**
 * Fetches the temperature data from the Dell iDRAC system using the Redfish API
 * @returns {Promise} A promise that resolves with the JSON response containing temperature data from the iDRAC API
 */
function getComponentsTemperature() {
    const d = D.q.defer()
    D.device.http.get({
        url: "/redfish/v1/Chassis/System.Embedded.1/Thermal",
        username: D.device.username(), 
        password: D.device.password(), 
        protocol: "https",
        auth: "basic",
        jar: true,
        rejectUnauthorized: false,
        headers: {
            Host: D.device.ip()
        }

    }, function (error, response, body) {
        if (error) {
            console.error(error)
            D.failure(D.errorType.GENERIC_ERROR)
        } else if (response.statusCode === 400) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else if (response.statusCode === 401) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (response.statusCode !== 200) {
            D.failure(D.errorType.GENERIC_ERROR)
        } else {
            d.resolve(JSON.parse(body))
        }
    })
    return d.promise
}

/**
 * Extracts temperature data from the response and populates the table
 * @param {Object} data The parsed response from the iDRAC Redfish API containing temperature data
 */
function extractData(data) {
     if (data && data.Temperatures && Array.isArray(data.Temperatures)) {
        for (var i = 0; i < data.Temperatures.length; i++) {
            var temp = data.Temperatures[i]
            populateTable({
                name: temp.Name,
                status: temp.Status.State === "Enabled" ? temp.Status.Health : "N/A",
                reading: temp.ReadingCelsius || 'N/A',
                warning_min: temp.LowerThresholdNonCritical || 'N/A',
                warning_max: temp.UpperThresholdNonCritical || 'N/A',
                critical_min: temp.LowerThresholdCritical || 'N/A',
                critical_max: temp.UpperThresholdCritical || 'N/A'
            })
        }
        D.success(table)
    } else {
        console.warn("No temperature data available")
        D.failure(D.errorType.PARSING_ERROR)
    }
}

/**
 * Sanitizes the output by removing reserved words and formatting it
 * @param {string} output The string to be sanitized
 * @returns {string} The sanitized string
 */
function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Populates the temperature data into the table for display
 * @param {Object} temperatureInfo The temperature data for a component
 */
function populateTable (temperatureInfo) {
    table.insertRecord(sanitize(temperatureInfo.name), [
      temperatureInfo.status,
      temperatureInfo.reading,
      temperatureInfo.warning_min,
      temperatureInfo.warning_max,
      temperatureInfo.critical_min,
      temperatureInfo.critical_max
    ])
  }

/**
 * @remote_procedure
 * @label Validate DELL iDRAC device
 * @documentation This procedure validates the presence of a Dell iDRAC device by checking the availability of a specific Redfish API endpoint for thermal data

 */
function validate(){
    getComponentsTemperature()
        .then(function (response) {
            if (response && response["@odata.id"].indexOf("/redfish/v1/Chassis/System.Embedded.1/Thermal") !== -1) {
                console.info("Data available")
                D.success()
            } else {
                console.error("Desired link not found")
                D.failure(D.errorType.GENERIC_ERROR)
            }
        })
        .catch(function (err) {
            console.error(err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}

/**
 * @remote_procedure
 * @label Get DEL iDRAC Components Temperature
 * @documentation This procedure retrieves the temperature status of the Dell iDRAC components.
 */
function get_status() {
    getComponentsTemperature()
        .then(extractData)
        .catch(function (err) {
            console.error(err)
            D.failure(D.errorType.GENERIC_ERROR)
        })
}