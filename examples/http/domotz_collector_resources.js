/**
 * Domotz Custom Driver 
 * Name: Domotz Collector Resources
 * Description: This script is designed to monitor Domotz agent resources
 * 
 * Communication protocol is HTTP
 * 
 * Tested on Domotz Agent version: 6.1.0-b001
 * 
 * Creates Custom Driver variables:
 *   - Status: Current status of the agent
 *   - Mode: Operating mode of the agent
 *   - Platform: Full platform name of the agent
 *   - Architecture: Architecture of the agent package
 *   - Agent Version: Version of the agent
 *   - Node Version: Node.js version used by the agent
 *   - System Uptime: Uptime of the system in seconds
 *   - Process Uptime: Uptime of the process in seconds
 *   - Load Average 1min: System load average over the last 1 minute
 *   - Load Average 5min: System load average over the last 5 minutes
 *   - Load Average 15min: System load average over the last 15 minutes
 *   - Free Memory: Free memory available in GB
 * 
 **/
  
/**
 * Retrieves resources info from the agent via HTTP GET request
 * @returns {Promise} A promise that resolves with the parsed data
 */
function getResources() {
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

function getDisplayValue(value) {
  return (value === undefined || value === null || value === '') ? 'N/A' : value
}

/**
 * Extracts and processes resource data from the response
 * @param {Object} data The resource data to process
 */
function extractData(data) {
  if (data && Object.keys(data).length > 0) {
    var variables = [
      D.createVariable('status', 'Status', getDisplayValue(data.status), null, D.valueType.STRING),
      D.createVariable('mode', 'Mode', getDisplayValue(data.mode), null, D.valueType.STRING),
      D.createVariable('platform', 'Platform', getDisplayValue(data.package && data.package.full_platform), null, D.valueType.STRING),
      D.createVariable('architecture', 'Architecture', getDisplayValue(data.package && data.package.pkg_architecture), null, D.valueType.STRING),
      D.createVariable('agent-version', 'Agent Version', getDisplayValue(data.package && data.package.agent_version), null, D.valueType.STRING),
      D.createVariable('node-version', 'Node Version', getDisplayValue(data.package && data.package.node_version), null, D.valueType.STRING),
      D.createVariable('system-uptime', 'System Uptime', getDisplayValue(data.uptime && data.uptime.system), "second", D.valueType.NUMBER),
      D.createVariable('process-uptime', 'Process Uptime', getDisplayValue(data.uptime && data.uptime.process), "second", D.valueType.NUMBER),
      D.createVariable('load-average-1-min', 'Load Average 1min', (data.loadavg && data.loadavg.length > 0) ? data.loadavg[0] : 'N/A', null, D.valueType.NUMBER),
      D.createVariable('load-average-5-min', 'Load Average 5min', (data.loadavg && data.loadavg.length > 1) ? data.loadavg[1] : 'N/A', null, D.valueType.NUMBER),
      D.createVariable('load-average-15-min', 'Load Average 15min', (data.loadavg && data.loadavg.length > 2) ? data.loadavg[2] : 'N/A', null, D.valueType.NUMBER),
      D.createVariable('freemem', 'Free Mem', isNaN(data.freemem) ? 'N/A' : (data.freemem / 1000000000).toFixed(2), "GB", D.valueType.NUMBER)
    ]
    D.success(variables)
  } else {
    console.error('No data found')
    D.failure(D.errorType.PARSING_ERROR)
  }
}
/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate the availability of resource data
 */
function validate(){
  getResources()
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
 * @label Get Agent Resource
 * @documentation This procedure is used to retrieve and process the resource data from the agent
 */
function get_status() {
  getResources()
    .then(extractData)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}