/**
 * Domotz Custom Driver 
 * Name: Domotz Collector Diagnostic
 * Description: This script is designed to monitor and troubleshoot the diagnostic data of a Collector 
 * 
 * Communication protocol is HTTP
 * 
 * Tested on Domotz Collector version: 6.1.0-b001
 * 
 * Creates Custom Driver variables:
 *    - Actual Discovery Counter: Represents the actual count of discovery events processed by the Collector
 *    - Missed Discovery Counter: Represents the count of discovery events that were missed
 * 
 * Creates Custom Driver table to display error counts with their corresponding error codes
 * 
 **/

// Create a Custom Driver table to store error counts from the diagnostic data
var table = D.createTable(
  'Error Counts',
  [
    { label: 'Count', valueType: D.valueType.NUMBER }
  ]
)

/**
 * Retrieves diagnostic data from the Collector via HTTP GET request.
 * @returns {Promise} A promise that resolves with the parsed diagnostic data.
 */
function getDiagnostic() {
  var d = D.q.defer()
  D.device.http.get({
    url: "/api/v1/status",
    jar: true,
    rejectUnauthorized: false,
    port: 3000
  }, function (error, response, body) {
    if (error) {          
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode == 404) {
      D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode != 200) {
      D.failure(D.errorType.GENERIC_ERROR)
    } 
    d.resolve(JSON.parse(body))
  })
  return d.promise
}

/**
 * Extracts and processes data from the diagnostic data response
 * @param {Object} data  The diagnostic data to process
 */
function extractData(data) {
  if (data && Object.keys(data).length > 0){
    var variables = [
      D.createVariable("actual_discovery_counter", "Actual Discovery Counter", data.diagnostic && data.diagnostic.actual_discovery_counter ? data.diagnostic.actual_discovery_counter : 0, null, D.valueType.NUMBER ),
      D.createVariable("missed_discovery_counter", "Missed Discovery Counter",  data.diagnostic && data.diagnostic.missed_discovery_counter ? data.diagnostic.missed_discovery_counter : 0, null, D.valueType.NUMBER )
    ]
    if (data.diagnostic && data.diagnostic.ignored_errors) {
      data.diagnostic.ignored_errors.forEach(function(errors){
        populateTable({
          id: errors.code,
          count: errors.count
        })
      })
    }
    D.success(variables, table)
  } else {
    console.error('No data found')
    D.failure(D.errorType.PARSING_ERROR)
	}
}

function populateTable (errors) {
  table.insertRecord(errors.id, [
    errors.count
  ])
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate the availability of diagnostic data
 */
function validate(){
  getDiagnostic()
    .then(function(data){
      if (data && Object.keys(data).length > 0) {
        console.info("Data available")
        D.success()
    } else {
      console.error("No data available")
      D.failure(D.errorType.PARSING_ERROR)
    }
    })
    .catch(function (err) {
        console.error(err)
        D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get Collector Diagnostic Data
 * @documentation This procedure is used to retrieve and process the diagnostic data
 */
function get_status() {
    getDiagnostic()
        .then(extractData)
        .catch(function (err) {
            console.error(err)
            D.failure(D.errorType.GENERIC_ERROR)
        });
}