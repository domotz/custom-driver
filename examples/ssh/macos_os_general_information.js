/**
 * Domotz Custom Driver
 * Name: macOS - OS General Information
 * Description: Monitors the general information for macintosh Operating System
 *
 * Communication protocol is SSH
 * 
 * Tested on macOS Version 14.5
 *
 * Creates a custom driver variable:
 *    - Name: The name of the macOS operating system
 *    - Version: Description: The version number of the macOS
 *    - Build Number: The specific build identifier of the macOS version
 *    - Machine model: The model of the Macintosh machine
 *    - Machine name: The name of the Macintosh machine
 *    - Architecture: The architecture type of the macOS
 *    - Serial Number: The serial number of the Macintosh machine
 * 
 **/

// SSH command to retrieve retrieve OS information
var command = 'uname -m && system_profiler SPSoftwareDataType SPHardwareDataType -json'

var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 5000
}

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
function executeCommand (command) {
  var d = D.q.defer()
  sshConfig.command = command
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

/**
 * Extracts variables from the SSH command output and creates custom driver variables
 * @param {string} output The output from the SSH command execution
 */
function extractVariables (output) {
  var lines = output.trim().split('\n')
  var architecture = lines[0] || 'N/A'
  var jsonContent = lines.slice(1).join('\n')
  var parsedData = JSON.parse(jsonContent)
  if (parsedData && parsedData.SPHardwareDataType && parsedData.SPHardwareDataType.length > 0) {
    var hardwareInfo = parsedData.SPHardwareDataType[0]
    var machineModel = hardwareInfo.machine_model || 'N/A'
    var machineName = hardwareInfo.machine_name || 'N/A'
    var serialNumber = hardwareInfo.serial_number || 'N/A'
  }
  if (parsedData && parsedData.SPSoftwareDataType && parsedData.SPSoftwareDataType.length > 0) {
    var softwareInfo = parsedData.SPSoftwareDataType[0]
    if (softwareInfo.os_version) {
      var name = softwareInfo.os_version.split(' ')[0] || 'N/A'
      var version = softwareInfo.os_version.split(' ')[1] || 'N/A'
      var buildNumber = softwareInfo.os_version.split(' ')[2].replace(/[()]/g, '') || 'N/A'
    } 
  }
  var variables = [
    D.createVariable('name', 'Name', name, null, D.valueType.STRING ),
    D.createVariable('version', 'Version', version, null, D.valueType.STRING ),
    D.createVariable('build-number', 'Build Number', buildNumber, null, D.valueType.STRING ),
    D.createVariable('machine-model', 'Machine model', machineModel, null, D.valueType.STRING ),
    D.createVariable('machine-name', 'Machine name', machineName, null, D.valueType.STRING ),
    D.createVariable('architecture', 'Architecture', architecture, null, D.valueType.STRING ),
    D.createVariable('serial-number', 'Serial Number', serialNumber, null, D.valueType.STRING )
  ]
  D.success(variables)
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(command)
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
 * @label Get macintosh Operating System Info
 * @documentation This procedure is used to extract information regarding the macintosh operating system, including details such as its name, version, build number, etc.
 */
function get_status () {
  executeCommand(command)
    .then(extractVariables)
    .catch(checkSshError)
}