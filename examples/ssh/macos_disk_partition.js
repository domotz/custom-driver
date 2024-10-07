/**
 * Domotz Custom Driver
 * Name: macOS - Disk partitions
 * Description: Monitors the status of disk partitions within a Macintosh machine
 * 
 * Communication protocol is SSH
 * 
 * Tested on macOS Version 14.5
 * 
 * 
 * Creates a custom driver table with the following columns: 
 *   - Usage: Percentage of disk space used
 *   - Free Space: Amount of free disk space available
 *   - Size: Total disk space available
 * 
 **/

// SSH command to retrieve retrieve disk partitons information
var cmdGetDiskPartion = 'diskutil info -all'

var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 10000
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
 * @param {string} cmdGetDiskPartion The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (cmdGetDiskPartion) {
  var d = D.q.defer()
  sshConfig.command = cmdGetDiskPartion
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
 * Parses the output of the SSH command to extract disk partitons information
 * @param {string} output The output from the SSH command execution
 * @returns {Array} An array of objects representing parsed disk partitons information
 */
function parseOutput(output) {
  if (output) {
    var lines = output.trim().split('\n')
    var partitions = []
    var currentDisk = {}
    for (var i = 0; i < lines.length; i++) {
      if (lines[i] === '' || lines[i].indexOf('**********') === 0) { continue }
      var match = lines[i].match(/^(.*?):\s*(.*)$/)
      if (match) {
        var key = match[1].trim()
        var value = match[2].trim()
        if (key === 'Device Identifier') {
          if (Object.keys(currentDisk).length > 0) {
            partitions.push(currentDisk)
          }
          currentDisk = { 'Device Identifier': value }
        } else {
          if (!currentDisk) { continue }
          currentDisk[key] = value
        }
      }
    }
    if (Object.keys(currentDisk).length > 0) {
      partitions.push(currentDisk)
    }
    var filteredDisks = partitions.filter(function(disk) {
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
 * Extracts relevant variables from parsed disk partitons and populates the table
 * @param {Array} partitions Array of objects representing parsed disk partitonsinformation
 */
function populateTable(partitions) {
  var parentDiskValues = {}
  var table
  partitions.forEach(function (disk) {
    var containerTotalSpace = disk['Container Total Space'] ? disk['Container Total Space'].match(/(\d+) Bytes/) : 0
    var volumeTotalSpace = disk['Volume Total Space'] ? disk['Volume Total Space'].match(/(\d+) Bytes/) : 0;
    var totalSpaceBytes = containerTotalSpace ? parseInt(containerTotalSpace[1]) : (volumeTotalSpace ? parseInt(volumeTotalSpace[1]) : 0)
    var containerFreeSpace = disk['Container Free Space'] ? disk['Container Free Space'].match(/(\d+) Bytes/) : 0
    var volumeFreeSpace = disk['Volume Free Space'] ? disk['Volume Free Space'].match(/(\d+) Bytes/) : 0
    var totalFreeSpaceBytes = containerFreeSpace ? parseInt(containerFreeSpace[1]) : (volumeFreeSpace ? parseInt(volumeFreeSpace[1]) : 0)
    var totalUsedSpace = totalSpaceBytes - totalFreeSpaceBytes
    var percentageUsedSpace = totalSpaceBytes > 0 ? (totalUsedSpace / totalSpaceBytes) * 100 : 0
    var parentDisk = disk['Part of Whole']
    if (!parentDiskValues[parentDisk]) {
      var freeSpace = convertToAppropriateUnits(totalFreeSpaceBytes)
      var size = convertToAppropriateUnits(totalSpaceBytes)
      parentDiskValues[parentDisk] = {
        freeSpace: freeSpace.value,
        size: size.value,
        freeSpaceUnit: freeSpace.unit,
        sizeUnit: size.unit
      }
      if (!table) {
        table = D.createTable(
          "Disk partitions", 
          [
            { label: "Usage", unit: '%', valueType: D.valueType.NUMBER },
            { label: "Free Space", unit: parentDiskValues[parentDisk].freeSpaceUnit, valueType: D.valueType.NUMBER },
            { label: "Size", unit: parentDiskValues[parentDisk].sizeUnit, valueType: D.valueType.NUMBER }
          ]
        )
      }
      table.insertRecord(sanitize(parentDisk), 
        [
          percentageUsedSpace,
          parentDiskValues[parentDisk].freeSpace,
          parentDiskValues[parentDisk].size
        ]
      )
    }
  })
  D.success(table)
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(cmdGetDiskPartion)
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
  * @label Get disk partitons Info
  * @documentation This procedure retrieves information about disk partitons within a Macintosh machine
 */
function get_status () {
  executeCommand(cmdGetDiskPartion)
    .then(parseOutput)
    .then(populateTable)
    .catch(checkSshError)
}