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
 *    - Signed by: Signer or authority responsible for signing the application
 *
 **/

// SSH command to retrieve retrieve OS information
var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 20000
}

var applicationName = D.getParameter('applicationName')

// Command to retrieve applications info
var cmdApplications = 'system_profiler SPApplicationsDataType -json'

// Table to store macOS applications information
var applicationsTable = D.createTable(
  "macOS Applications",
  [
    { label: "Name", valueType: D.valueType.STRING },
    { label: "Version", valueType: D.valueType.STRING },
    { label: "Path", valueType: D.valueType.STRING },
    { label: "Architecture", valueType: D.valueType.STRING },
    { label: "Last modified", valueType: D.valueType.DATETIME }, 
    { label: "Source", valueType: D.valueType.STRING },
    { label: "Signed by", valueType: D.valueType.STRING }
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
function executeCommand (cmdApplications) {
  var d = D.q.defer()
  sshConfig.command = cmdApplications
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
    dateTime.getSeconds()
  return formattedDate
}

/**
 * Populates the applications table with retrieved data
 * @param {Array} applications Array of application data objects
 */
function populateTable (applications) {
  applications.forEach(function(app) {
    var recordId = sanitize(app.name + "-" + app.version)
    var formattedLastModified = formatDate(app.lastModified)
    var signedBy = Array.isArray(app.signedBy) ? app.signedBy.map(function(signer) {
      return signer.replace(/[\[\]']+/g, ''); 
    }).join(', ') : app.signedBy
    applicationsTable.insertRecord(recordId, [
      app.name,
      app.version || 'N/A',
      app.path || 'N/A',
      app.architecture || 'N/A',
      formattedLastModified,
      app.source || 'N/A',
      signedBy || 'N/A'
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
    var parsedData = JSON.parse(output)
    if (parsedData && parsedData.SPApplicationsDataType && parsedData.SPApplicationsDataType.length > 0) {
      var filteredData = []
      parsedData.SPApplicationsDataType.forEach(function(app){
        if (applicationName[0].toUpperCase() === 'ALL' || applicationName.includes(app._name)) {
          var applications =  {
            name: app._name,
            version: app.version,
            path: app.path,
            architecture: app.arch_kind,
            lastModified: app.lastModified,
            source: app.obtained_from,
            signedBy: app.signed_by
          }
          filteredData.push(applications)
        }
      })
      populateTable(filteredData)        
    } else {
      console.error('Invalid or empty SPApplicationsDataType')
      D.failure(D.errorType.PARSING_ERROR);
    }
  } else {
    console.error('No data found')
    D.failure(D.errorType.PARSING_ERROR)
  }
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(cmdApplications)
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
  executeCommand(cmdApplications)
    .then(extractVariables)
    .catch(checkSshError)
}