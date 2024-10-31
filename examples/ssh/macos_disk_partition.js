/**
 * Domotz Custom Driver
 * Name: macOS - Disk Partitions
 * Description: Monitors the status of disk partitions within a Macintosh machine
 * 
 * Communication protocol is SSH
 * 
 * Tested on macOS Version 14.5
 * 
 * Creates a custom table with rows for each disk partition, including the following columns
 *   - ID: The name of the disk partition
 *   - Usage: Percentage of disk space used
 *   - Free Space: Amount of free disk space available
 *   - Size: Total disk space available
 **/

// SSH command to retrieve retrieve disk partitions information
var cmdGetDiskPartition = 'diskutil info -all'

var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 10000
}

var table = D.createTable(
  "Disk partitions", 
  [
    { label: "Usage", unit: '%', valueType: D.valueType.NUMBER },
    { label: "Free Space", unit: "GB", valueType: D.valueType.NUMBER },
    { label: "Size", unit: "GB", valueType: D.valueType.NUMBER }
  ]
)
/**
 * Checks SSH command errors and handles them appropriately
 * @param {Error} err The error object from the SSH command execution
 */
function checkSshError (err) {
  if (err.message) console.error(err.message)
  if (err.code === 5){
    D.failure(D.errorType.AUTHENTICATION_ERROR)
  } else if (err.code === 255 || err.code === 1) {
    D.failure(D.errorType.RESOURCE_UNAVAILABLE)
  } else {
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
  }
}

/**
 * Executes an SSH command using the provided configuration
 * @param {string} cmdGetDiskPartition The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (cmdGetDiskPartition) {
  var d = D.q.defer()
  sshConfig.command = cmdGetDiskPartition
  D.device.sendSSHCommand(sshConfig, function (output, error) {
    if (error) { 
      if (error.message.indexOf('command not found') !== -1){
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
      } else { 
        checkSshError(error)
        d.reject(error)
      }
    } else {
      d.resolve(output)
    }
  })
  return d.promise
}

/**
 * Parses the output of the SSH command to extract disk partitions information
 * @param {string} output The output from the SSH command execution
 * @returns {Array} An array of objects representing parsed disk partitions information
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

function convertToGB(bytes) {
  return (bytes / 1e9).toFixed(2)
} 

/**
 * Extracts relevant variables from parsed disk partitions and populates the table
 * @param {Array} partitions Array of objects representing parsed disk partitionsinformation
 */
function populateTable(partitions) {
  var parentDiskValues = {}
  partitions.forEach(function (disk) {
    var containerTotalSpace = disk['Container Total Space'] ? disk['Container Total Space'].match(/(\d+) Bytes/) : 0
    var volumeTotalSpace = disk['Volume Total Space'] ? disk['Volume Total Space'].match(/(\d+) Bytes/) : 0
    var totalSpaceBytes = containerTotalSpace ? parseInt(containerTotalSpace[1]) : (volumeTotalSpace ? parseInt(volumeTotalSpace[1]) : 0)
    var containerFreeSpace = disk['Container Free Space'] ? disk['Container Free Space'].match(/(\d+) Bytes/) : 0
    var volumeFreeSpace = disk['Volume Free Space'] ? disk['Volume Free Space'].match(/(\d+) Bytes/) : 0
    var totalFreeSpaceBytes = containerFreeSpace ? parseInt(containerFreeSpace[1]) : (volumeFreeSpace ? parseInt(volumeFreeSpace[1]) : 0)
    var totalUsedSpace = totalSpaceBytes - totalFreeSpaceBytes
    var percentageUsedSpace = totalSpaceBytes > 0 ? (totalUsedSpace / totalSpaceBytes) * 100 : 0
    var parentDisk = disk['Part of Whole']
    if (!parentDiskValues[parentDisk]) {
      var freeSpace = convertToGB(totalFreeSpaceBytes)
      var size = convertToGB(totalSpaceBytes)
      parentDiskValues[parentDisk] = {
        freeSpace: freeSpace,
        size: size,
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

function parseValidateOutput (output) {
  if (output.trim() !== '') {
    console.log('Validation successful')
    D.success()
  } else {
    console.log('Validation failed')
    D.failure(D.errorType.GENERIC_ERROR)
  }
}
/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(cmdGetDiskPartition)
    .then(parseValidateOutput)
    .catch(function (err) {
      console.error(err)
      D.failure(D.errorType.GENERIC_ERROR)
    })
}



/**
  * @remote_procedure
  * @label Get disk partitions Info
  * @documentation This procedure retrieves information about disk partitions within a Macintosh machine
 */
function get_status () {
  executeCommand(cmdGetDiskPartition)
    .then(parseOutput)
    .then(populateTable)
    .catch(checkSshError)
}