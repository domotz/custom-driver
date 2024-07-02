/**
 * Domotz Custom Driver
 * Name: macOS - Applications
 * Description: Retrieves details of installed applications on macOS
 *
 * Communication protocol is SSH
 *
 * Tested on macOS Version 14.5
 *
 * Creates a custom driver table:
 *    - Name: Name of the application
 *    - Version: Version number of the application
 *    - Path: Installation path of the application
 *    - Architecture: Architecture type of the application
 *    - Last modified: Last modified timestamp of the application
 *    - Source: Source from where the application was obtained
 *
 **/

// SSH command to retrieve retrieve OS information
var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 10000
}

var applicationName = D.getParameter('applicationName')
// Command to retrieve applications info
var cmdApplications = 'system_profiler SPApplicationsDataType -json'
// Fields to retrieve from the command output
var fields = ' | grep -E "_name|version|path|arch_kind|obtained_from|lastModified"'
var applications
if (applicationName[0].toUpperCase() === 'ALL') {
  applications = cmdApplications + fields
} else {
  var applicationFilter = applicationName.map(function(app) { return '"' + app + '"' }).join('|')
  var filterCommand = " | grep -E '\\\"_name\\\" : (" + applicationFilter + ")' -A 11"
  applications = cmdApplications + filterCommand + fields
}

// Table to store macOS applications information
var applicationsTable = D.createTable(
  "macOS Applications",
  [
    { label: "Name", valueType: D.valueType.STRING },
    { label: "Version", valueType: D.valueType.STRING },
    { label: "Path", valueType: D.valueType.STRING },
    { label: "Architecture", valueType: D.valueType.STRING },
    { label: "Last modified", valueType: D.valueType.DATETIME }, 
    { label: "Source", valueType: D.valueType.STRING }
  ]
)

/**
 * Checks SSH command errors and handles them appropriately
 * @param {Error} err The error object from the SSH command execution
 */
function checkSshError (err) {
  if(err.message) console.error(err.message)
  if(err.code == 5){
    D.failure(D.errorType.AUTHENTICATION_ERROR)
  } else if (err.code == 255 || err.code == 1) {
    D.failure(D.errorType.RESOURCE_UNAVAILABLE)
  } else {
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
  }
}

/**
 * Executes an SSH command using the provided configuration
 * @param {string} command The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (applications) {
  var d = D.q.defer()
  sshConfig.command = applications
  D.device.sendSSHCommand(sshConfig, function (output, error) {
    if (error) {
      checkSshError(error)
      d.reject(error)
    } else {
      d.resolve(output)
    }
  })
  return d.promise
}

function sanitize (output) {
  var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Formats a date into a string in the format 'MM-DD-YYYY HH:mm:ss'.
 * @param {String} date The date object to format.
 * @returns {string} The formatted date string.
 */
function formatDate(date) {
  if (!date) return 'N/A';
  var dateTime = new Date(date);
  var formattedDate =
    (dateTime.getMonth() + 1) + '-' +
    dateTime.getDate() + '-' +
    dateTime.getFullYear() + ' ' +
    dateTime.getHours() + ':' +
    dateTime.getMinutes() + ':' +
    dateTime.getSeconds();
  return formattedDate
}

/**
 * Populates the applications table with retrieved data
 * @param {Array} data Array of application data objects
 */
function populateTable (data) {
  data.forEach(function(app) {
    var recordId = sanitize(app.name + "-" + app.version)
    var formattedLastModified = formatDate(app.lastModified)
    applicationsTable.insertRecord(recordId, [
      app.name,
      app.version || 'N/A',
      app.path || 'N/A',
      app.architecture || 'N/A',
      formattedLastModified,
      app.source || 'N/A'
    ])
  })
  D.success(applicationsTable)
}

/**
 * Extracts variables from the SSH command output and populates the applications table
 * @param {string} output The output from the SSH command execution
 */
function extractVariables (output) {
  if (output){
    var lines = output.split('\n').map(function(line) { return line.trim() })
    var applications = []
    var currentApp = {}
    lines.forEach(function(line) {
      var match = line.match(/"([^"]+)"\s*:\s*"([^"]*)"/)
      if (match) {
        var key = match[1]
        var value = match[2]
        var keyMappings = {
          _name: 'name',
          arch_kind: 'architecture',
          version: 'version',
          path: 'path',
          lastModified: 'lastModified',
          obtained_from: 'source'
        }
        if (key === '_name' && Object.keys(currentApp).length > 0) {
          applications.push(currentApp)
          currentApp = {}
        }
        var mappedKey = keyMappings[key]
        if (mappedKey) {
          currentApp[mappedKey] = value
        }
      }
    })
    if (Object.keys(currentApp).length > 0) {
      applications.push(currentApp)
    }
    populateTable(applications)
  } else {
    D.failure(D.errorType.PARSING_ERROR)
  }
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(applications)
    .then(parseValidateOutput)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

function parseValidateOutput (output) {
  if (output.trim !== undefined && output.trim() !== '') {
    console.log('Validation successful')
    D.success()
  }
}

/**
 * @remote_procedure
 * @label Get macOS Applications
 * @documentation This procedure is used to extract details about installed applications on the system, including version information and installation paths
 */
function get_status () {
  executeCommand(applications)
    .then(extractVariables)
    .catch(checkSshError)
}