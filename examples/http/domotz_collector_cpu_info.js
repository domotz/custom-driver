/**
 * Domotz Custom Driver 
 * Name: Domotz Collector CPU Info
 * Description: This script is designed to monitor CPU information of an agent 
 * 
 * Communication protocol is HTTP
 * 
 * Tested on Domotz Agent version: 6.1.0-b001
 * 
 * Creates Custom Driver table with the following columns:
 *    - Model:The model of the CPU
 *    - Speed: The CPU speed
 *    - User Time: Time spent in user mode
 *    - Nice Time: Time spent in user mode with positive nice value
 *    - Sys Time: Time spent in system mode 
 *    - Idle Time: Time spent idle 
 *    - IRQ Time: Time spent handling interrupts
 *    
 **/

// Create a Custom Driver table to store CPU info 
var table = D.createTable(
  'CPUs Info',
  [
    { label: 'Model', valueType: D.valueType.STRING },
    { label: 'Speed', valueType: D.valueType.NUMBER },
    { label: 'User Time', valueType: D.valueType.NUMBER },
    { label: 'Nice Time', valueType: D.valueType.NUMBER },
    { label: 'Sys Time', valueType: D.valueType.NUMBER },
    { label: 'Idle Time', valueType: D.valueType.NUMBER },
    { label: 'IRQ Time', valueType: D.valueType.NUMBER }
  ]
)

/**
 * Retrieves CPU info from the agent via HTTP GET request.
 * @returns {Promise} A promise that resolves with the parsed CPU Info.
 */
function getCPUInfo() {
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
 * Extracts and processes CPU Info from the response
 * @param {Object} data The CPU Info to process
 */
function extractData(data) {
  if (data && Object.keys(data).length > 0 && Array.isArray(data.cpus) && data.cpus.length > 0) {    
    data.cpus.forEach(function(info, index) {
      populateTable({
        id: (index + 1).toString(),
        model: getDisplayValue(info.model),
        speed: getDisplayValue(info.speed),
        userTime: getDisplayValue(info.times && info.times.user),
        niceTime: getDisplayValue(info.times && info.times.nice),
        sysTime: getDisplayValue(info.times && info.times.sys),
        idleTime: getDisplayValue(info.times && info.times.idle),
        irqTime: getDisplayValue(info.times && info.times.irq)
      })
    })
    D.success(table)
  } else {
    console.error('No CPU data found')
    D.failure(D.errorType.PARSING_ERROR)
  }
}

function populateTable (cpusInfo) {
  table.insertRecord(cpusInfo.id, [
    cpusInfo.model,
    cpusInfo.speed,
    cpusInfo.userTime,
    cpusInfo.niceTime,
    cpusInfo.sysTime,
    cpusInfo.idleTime,
    cpusInfo.irqTime
  ])
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate the availability of CPU Info
 */
function validate(){
  getCPUInfo()
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
 * @label Get Agent CPU Info
 * @documentation This procedure is used to retrieve and process the CPU Info data from the agent
 */
function get_status() {
  getCPUInfo()
    .then(extractData)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}