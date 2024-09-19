/**
 * Domotz Custom Driver
 * Name: macOS Volumes
 * Description: Monitors the status of volumes within a Macintosh machine
 * 
 * Communication protocol is SSH
 *
 * Tested on macOS Version 14.5
 * 
 * Creates a custom driver table with the following columns: 
 *   - Name: Volume Name
 *   - Node: Device Node (path) of the volume
 *   - Partition: The disk that this volume is part of
 *   - Mount Point: The path where the volume is mounted
 *   - Partition Usage: The percentage of the volume's total space that is currently used
 *   - File System: File system type used by the volume
 *   - ReadOnly: Indicates if the volume is read-only
 *   - Status: The status of the volume
 * 
 **/

// SSH command to retrieve volume information
var cmdGetVolumes = 'diskutil info -all'

var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 10000
}

// Custom Driver Table to store volume information
var table = D.createTable(
  "Volumes", 
  [
    { label: "Name", valueType: D.valueType.STRING },
    { label: "Node", valueType: D.valueType.STRING },
    { label: "Partition", valueType: D.valueType.STRING },
    { label: "Mount Point", valueType: D.valueType.STRING },
    { label: "Partition Usage", unit: "%", valueType: D.valueType.NUMBER },
    { label: "File System", valueType: D.valueType.STRING },
    { label: "ReadOnly", valueType: D.valueType.STRING },
    { label: "Status", valueType: D.valueType.STRING }
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
 * @param {string} cmdGetVolumes The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (cmdGetVolumes) {
  var d = D.q.defer()
  sshConfig.command = cmdGetVolumes
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
 * Parses the output of the SSH command to extract volume information
 * @param {string} output The output from the SSH command execution
 * @returns {Array} An array of objects representing parsed volume information
 */
function parseOutput(output) {
  if (output) {
    var lines = output.trim().split('\n')
    var logicalDisks = []
    var currentDisk = {}
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === '' || lines[i].indexOf('**********') === 0) { continue }
      var match = lines[i].match(/^(.*?):\s*(.*)$/)
      if (match) {
        var key = match[1].trim()
        var value = match[2].trim()
        if (key === 'Device Identifier') {
          if (Object.keys(currentDisk).length > 0) {
            logicalDisks.push(currentDisk);
          }
          currentDisk = { 'Device Identifier': value }
        } else {
          if (!currentDisk) { continue }
          currentDisk[key] = value
        }
      }
    }
    if (Object.keys(currentDisk).length > 0) {
      logicalDisks.push(currentDisk)
    }
    var filteredDisks = logicalDisks.filter(function(disk) {
      return disk['Mount Point'] && disk['Mount Point'].includes('/Volumes')
    })
    return filteredDisks

  } else {
    console.error('No data found')
    D.failure(D.errorType.PARSING_ERROR)
  }
}

function sanitize (output) {
  var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * Extracts relevant variables from parsed volumes and populates the table
 * @param {Array} logicalDisks Array of objects representing parsed logical disk information
 */
function populateTable(logicalDisks) {

  logicalDisks.forEach(function (disk) {
    var usedSpaceBytes = disk['Volume Used Space'] ? parseInt(disk['Volume Used Space'].match(/(\d+) Bytes/)[1]) : 0
    var containerTotalSpace = disk['Container Total Space'] ? disk['Container Total Space'].match(/(\d+) Bytes/) : 0
    var volumeTotalSpace = disk['Volume Total Space'] ? disk['Volume Total Space'].match(/(\d+) Bytes/) : 0
    var totalSpaceBytes = containerTotalSpace ? parseInt(containerTotalSpace[1]) : (volumeTotalSpace ? parseInt(volumeTotalSpace[1]) : 0)
    var usagePercentage = totalSpaceBytes > 0 ? ((usedSpaceBytes / totalSpaceBytes) * 100).toFixed(2) : 0
    table.insertRecord(sanitize(disk['Device Identifier']), 
      [
        disk['Volume Name'] || 'N/A',
        disk['Device Node'] || 'N/A',
        disk['Part of Whole'] || 'N/A',
        disk['Mount Point'] || 'N/A',
        usagePercentage,
        disk['File System Personality'] || 'N/A',
        disk['Volume Read-Only'] || 'N/A',
        disk['SMART Status'] || 'N/A'
      ]
    )
  })
  D.success(table)
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association
 */
function validate () {
  executeCommand(cmdGetVolumes)
    .then(parseValidateOutput)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}

function parseValidateOutput (output) {
  if (output && typeof output === 'string' && output.trim() !== '') {
    console.log('Validation successful')
    D.success()
  } else {
    console.error('Output is empty or undefined')
    D.failure(D.errorType.PARSING_ERROR)
  }
}

/**
 * @remote_procedure
  * @label Get volumes Info
  * @documentation This procedure retrieves information about volumes installed on a Macintosh machine
 */
function get_status () {
  executeCommand(cmdGetVolumes)
    .then(parseOutput)
    .then(populateTable)
    .catch(checkSshError)
}