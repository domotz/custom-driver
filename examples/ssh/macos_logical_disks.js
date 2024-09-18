/**
 * Domotz Custom Driver
 * Name: macOS - Logical Disks
 * Description: Monitors the status of logical disks within a Macintosh machine
 * 
 * Communication protocol is SSH
 *
 * Tested on macOS Version 14.5
 * 
 * Creates Custom Driver variables:
 *   - Free Space: The amount of free space available on the disk
 *   - Size: The total size of the disk
 * 
 * Creates a custom driver table with the following columns: 
 *   - Name: Volume Name of the disk
 *   - Node: Device Node (path) of the disk
 *   - Parent Disk: The disk that this volume is part of
 *   - Mount Point: The path where the volume is mounted
 *   - Usage: The percentage of the volume total space that is currently used
 *   - File System: File system type used by the volume
 *   - ReadOnly: Indicates if the volume is read-only
 *   - Status: SMART status of the disk
 * 
 **/

// SSH command to retrieve retrieve logical disks information
var cmdGetLogicalDisks = 'diskutil info -all'

var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 10000
}

// Custom Driver Table to store Logical disk information
var table = D.createTable(
  "Logical Disks", 
  [
    { label: "Name", valueType: D.valueType.STRING },
    { label: "Node", valueType: D.valueType.STRING },
    { label: "Parent Disk", valueType: D.valueType.STRING },
    { label: "Mount Point", valueType: D.valueType.STRING },
    { label: "Usage", unit: "%", valueType: D.valueType.NUMBER },
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
 * @param {string} cmdGetLogicalDisks The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (cmdGetLogicalDisks) {
  var d = D.q.defer()
  sshConfig.command = cmdGetLogicalDisks
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
 * Parses the output of the SSH command to extract logical disk information
 * @param {string} output The output from the SSH command execution
 * @returns {Array} An array of objects representing parsed logical disk information
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

function convertToAppropriateUnits(bytes) {
  if (bytes >= 1e9) {
    return {
      value: (bytes / 1e9).toFixed(2),
      unit: 'GB'
    }
  } else {
    return {
      value: (bytes / 1e6).toFixed(2),
      unit: 'MB'
    }
  }
}

/**
 * Extracts relevant variables from parsed logical disks and populates the table
 * @param {Array} logicalDisks Array of objects representing parsed logical disk information
 */
function populateTable(logicalDisks) {
  var parentDiskValues = {}
  var variables = []
  logicalDisks.forEach(function (disk) {
    var usedSpaceBytes = disk['Volume Used Space'] ? parseInt(disk['Volume Used Space'].match(/(\d+) Bytes/)[1]) : 0
    var containerTotalSpace = disk['Container Total Space'] ? disk['Container Total Space'].match(/(\d+) Bytes/) : 0
    var volumeTotalSpace = disk['Volume Total Space'] ? disk['Volume Total Space'].match(/(\d+) Bytes/) : 0
    var totalSpaceBytes = containerTotalSpace ? parseInt(containerTotalSpace[1]) : (volumeTotalSpace ? parseInt(volumeTotalSpace[1]) : 0)
    var containerFreeSpace = disk['Container Free Space'] ? disk['Container Free Space'].match(/(\d+) Bytes/) : 0
    var volumeFreeSpace = disk['Volume Free Space'] ? disk['Volume Free Space'].match(/(\d+) Bytes/) : 0
    var totalFreeSpaceBytes = containerFreeSpace ? parseInt(containerFreeSpace[1]) : (volumeFreeSpace ? parseInt(volumeFreeSpace[1]) : 0)
    var usagePercentage = totalSpaceBytes > 0 ? ((usedSpaceBytes / totalSpaceBytes) * 100).toFixed(2) : 0
    var parentDisk = disk['Part of Whole']
  
    if (!parentDiskValues[parentDisk]) {
      var freeSpace = convertToAppropriateUnits(totalFreeSpaceBytes);
      var size = convertToAppropriateUnits(totalSpaceBytes);
      parentDiskValues[parentDisk] = {
        freeSpace: freeSpace.value,
        size: size.value,
        freeSpaceUnit: freeSpace.unit,
        sizeUnit: size.unit
      }
      variables.push(
        D.createVariable(parentDisk + '-free-space', parentDisk + ' Free Space', parentDiskValues[parentDisk].freeSpace, parentDiskValues[parentDisk].freeSpaceUnit, D.valueType.NUMBER),
        D.createVariable(parentDisk + '-size', parentDisk + ' Size', parentDiskValues[parentDisk].size, parentDiskValues[parentDisk].sizeUnit, D.valueType.NUMBER)
      ) 
    }
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
  D.success(variables, table)
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(cmdGetLogicalDisks)
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
  * @label Get logical Disks Info
  * @documentation This procedure retrieves information about logical disks installed on a Macintosh machine
 */
function get_status () {
  executeCommand(cmdGetLogicalDisks)
    .then(parseOutput)
    .then(populateTable)
    .catch(checkSshError)
}