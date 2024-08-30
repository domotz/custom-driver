/**
 * Domotz Custom Driver 
 * Name: VMWare vCenter Monitoring Hosts info
 * Description: This script retrieves detailed information about VMware vCenter hosts.
 * 
 * Communication protocol is HTTPS
 * 
 * Tested on VMWare vCenter version 8.0.2
 * 
 * Creates a Custom Driver Table with the following columns:
 *      - Name: The name of the host
 *      - Model: The hardware vendor and system model identification
 *      - Operating System: The operating system installed on the host
 *      - CPU: The CPU model
 *      - Processors: Number of physical CPU packages on the host
 *      - Cores: Number of physical CPU cores on the host
 *      - Memory: The physical memory size in GiB
 *      - Memory Usage: The percentage of used memory
 *      - CPU Usage: The percentage of CPU usage
 *      - Power State: The host power state
 *      - Connection State: The hostconnection state
 *      - Status: The overall health status of the host
 *      - Uptime: The system uptime of the host in hours
 * 
 **/

// Parameter for specifying which hosts to retrieve
var hostId = D.getParameter("hostId")

// Create a Custom Driver table to store hosts information
var table = D.createTable(
  "Hosts Info",[
    { label: "Name", valueType: D.valueType.STRING },
    { label: "Model", valueType: D.valueType.STRING },
    { label: "Operating System", valueType: D.valueType.STRING },
    { label: "CPU Model", valueType: D.valueType.STRING },
    { label: "Processors", valueType: D.valueType.NUMBER },
    { label: "Cores", valueType: D.valueType.NUMBER },
    { label: "Memory", unit: "GiB", valueType: D.valueType.NUMBER },
    { label: "Memory Usage", unit: "%", valueType: D.valueType.NUMBER },
    { label: "CPU Usage", unit: "%", valueType: D.valueType.NUMBER },
    { label: "Power State", valueType: D.valueType.STRING },
    { label: "Connection State", valueType: D.valueType.STRING },
    { label: "Status", valueType: D.valueType.STRING },
    { label: "Uptime", unit: "hours", valueType: D.valueType.NUMBER }
  ]
)

/**
 * Logs in to the VMware vCenter and retrieves a session ID
 * @returns {Promise} A promise that resolves with the session ID or rejects with an error
 */
function login() {
  var d = D.q.defer()
  var config = {
    url: "/api/session",
    username: D.device.username(),
    password: D.device.password(),
    protocol: "https",
    auth: "basic",
    jar: true,
    rejectUnauthorized: false
  }
  D.device.http.post(config, function(error, response, body){
    if (error) {          
      console.error(error);
      D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode == 404) {
      D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode == 401) {
      D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (response.statusCode != 201) {
      D.failure(D.errorType.GENERIC_ERROR)
    } 
    d.resolve(JSON.parse(body))
  })
  return d.promise
}

/**
 * Retrieves the list of hosts from VMware vCenter
 * @param {string} sessionId - The session ID used for authentication
 * @returns {Promise} A promise that resolves with an array of host IDs or rejects with an error
 */
function getHostList(sessionId) {
  var d = D.q.defer()
  var config = {
    url: "/api/vcenter/host",
    protocol: "https",
    jar: true,
    rejectUnauthorized: false,
    headers: {
      "vmware-api-session-id": sessionId 
    }
  }
  D.device.http.get(config, function(error, response, body){
    if (error) {          
      console.error(error)
      D.failure(D.errorType.GENERIC_ERROR)
    } else if (response.statusCode == 404) {
      D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else if (response.statusCode != 200) {
      D.failure(D.errorType.GENERIC_ERROR)
    } else {
      var data = JSON.parse(body)
      if (Array.isArray(data) && data.length > 0) {
        var hosts = data.map(function(item) { return item.host })
        var filteredHosts
          if (hostId.length === 1 && hostId[0].toLowerCase() === 'all') {
            filteredHosts = hosts
          } else {
            filteredHosts = hosts.filter(function(host) {
              return hostId.includes(host)
            })
          }
          d.resolve(filteredHosts)
      } else {
        console.error('No hosts found')
        D.failure(D.errorType.PARSING_ERROR)
      }
    }
  })
  return d.promise
}

/**
 * Retrieves detailed information for each host from VMware vCenter
 * @param {string} sessionId - The session ID obtained from the login function
 * @param {Array} hostIds - Array of host IDs to retrieve information fors
 * @returns {Promise} A promise that resolves with the host information or rejects with an error
 */
function getHostInfo(sessionId, hostIds) {
  var promises = hostIds.map(function(hostId) {
    var d = D.q.defer()
    var config = {
      url: "/sdk/vim25/8.0.1.0/HostSystem/" + hostId + "/summary",
      protocol: "https",
      jar: true,
      rejectUnauthorized: false,
      headers: {
        "vmware-api-session-id": sessionId 
      }
    }
    D.device.http.get(config, function(error, response, body) {
      if (error) {          
        console.error(error)
        D.failure(D.errorType.GENERIC_ERROR)
      } else {
        if (response.body && response.body.indexOf("Invalid URI") !== -1) {
          console.error("Invalid URI")
          D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else {
          var data = JSON.parse(body)
          if (data._typeName === 'ManagedObjectNotFound') {
            console.error('Host "' + data.obj.value + '" has already been deleted or has not been completely created')
            d.resolve(null)
          } else {
            d.resolve(data)
          }
        }
      } 
    })
    return d.promise
  })
  return D.q.all(promises)
    .then(function (results) {
      return results.filter(function (result) { return result !== null })
    })
}

/**
 * Extracts and processes host data from the API response, then populates the table
 * @param {Object} body - The array of host objects returned from the API
 */
function extractData(body) {
  if (body && body.length > 0){
    for (var i = 0; i < body.length; i++) {
      var hostsInfo = body[i]
      var hardwareVendor = hostsInfo.hardware && hostsInfo.hardware.vendor ? hostsInfo.hardware.vendor : 'N/A' // The hardware vendor identification
      var systemModel = hostsInfo.hardware && hostsInfo.hardware.model ? hostsInfo.hardware.model : 'N/A' // The system model identification
      var productName = (hostsInfo.config && hostsInfo.config.product && hostsInfo.config.product.fullName) || "N/A" // The complete product name, including the version information
      var osType = (hostsInfo.config && hostsInfo.config.product && hostsInfo.config.product.osType) || "N/A" // Operating system type and architecture
      var memoryInBytes = hostsInfo.hardware && hostsInfo.hardware.memorySize ? hostsInfo.hardware.memorySize : 0 // The physical memory size in bytes
      var memoryInMiB = (memoryInBytes / Math.pow(1024, 2)).toFixed(2)
      var usedMemory = hostsInfo.quickStats && hostsInfo.quickStats.overallMemoryUsage ? hostsInfo.quickStats.overallMemoryUsage : 0 // Physical memory usage on the host in MB
      var cpuMhz = hostsInfo.hardware && hostsInfo.hardware.cpuMhz ? hostsInfo.hardware.cpuMhz : 0 // The speed of the CPU cores
      var numCpuCores = hostsInfo.hardware && hostsInfo.hardware.numCpuCores ? hostsInfo.hardware.numCpuCores : 0 // Number of physical CPU cores on the host
      var totalCpuCapacity = cpuMhz * numCpuCores 
      var usedCPU = hostsInfo.quickStats && hostsInfo.quickStats.overallCpuUsage ? hostsInfo.quickStats.overallCpuUsage : 0 // Aggregated CPU usage across all cores on the host in MHz
      var colorToStatus = {
        "gray": "N/A",
        "green": "OK",
        "yellow": "WARNING",
        "red": "NOT OK"
      }
      var health = hostsInfo.overallStatus || "N/A"
      populateTable({
        id: hostsInfo.host.value,
        name: hostsInfo.config && hostsInfo.config.name ? hostsInfo.config.name : 'N/A',
        model: hardwareVendor + " " + systemModel,
        operatingSystem: productName + " (" + osType + ")",
        cpuModel: hostsInfo.hardware && hostsInfo.hardware.cpuModel ? hostsInfo.hardware.cpuModel : 'N/A',
        processors: hostsInfo.hardware && hostsInfo.hardware.numCpuPkgs ? hostsInfo.hardware.numCpuPkgs : 0,
        cores: hostsInfo.hardware && hostsInfo.hardware.numCpuCores ? hostsInfo.hardware.numCpuCores : 0,
        memory: (memoryInBytes / Math.pow(1024, 3)).toFixed(2),
        memoryUsage: ((usedMemory / memoryInMiB) * 100).toFixed(2),
        cpuUsage: ((usedCPU / totalCpuCapacity) * 100).toFixed(2),
        powerState: hostsInfo.runtime && hostsInfo.runtime.powerState ? hostsInfo.runtime.powerState : 'N/A',
        connectionState: hostsInfo.runtime && hostsInfo.runtime.connectionState ? hostsInfo.runtime.connectionState : 'N/A',
        status: colorToStatus[health] || "N/A",
        uptime: Math.floor(hostsInfo.quickStats.uptime / 3600)
      }) 
    }
    D.success(table)
  } else {
    console.error("No data available")
    D.failure(D.errorType.PARSING_ERROR)
  }
}

function sanitize(output){
  var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
  var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
  return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}
  
function populateTable(info) {
  table.insertRecord(
    sanitize(info.id), [
      info.name,
      info.model,
      info.operatingSystem,
      info.cpuModel,
      info.processors,
      info.cores,
      info.memory,
      info.memoryUsage,
      info.cpuUsage,
      info.powerState,
      info.connectionState,
      info.status,
      info.uptime
    ]
  )
}
  
/**
 * @remote_procedure
 * @label Validate Connection 
 * @documentation This procedure is used to validate the connection and data retrieval from the VMWare device
 */
function validate(){
  login()
    .then(function (sessionId) {
      return getHostList(sessionId)
        .then(function (filteredHosts) {
          return getHostInfo(sessionId, filteredHosts)
        })   
    })
    .then(function (hostsInfo) {
      if (!hostsInfo || hostsInfo.length === 0) {
        console.error("No data available")
        D.failure(D.errorType.PARSING_ERROR)
      } else {
        console.log("validation successful")
        D.success()
      }
    })
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

/**
 * @remote_procedure
 * @label Get VMware vCenter Hosts info
 * @documentation This procedure retrieves detailed information about VMware vCenter hosts
 */
function get_status() {
  login()
    .then(function (sessionId) {
      return getHostList(sessionId)
        .then(function (filteredHosts) {
          return getHostInfo(sessionId, filteredHosts)
        })   
    })
    .then(extractData)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}