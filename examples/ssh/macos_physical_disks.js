/**
 * Domotz Custom Driver
 * Name: macOS - Physical Disks
 * Description: Monitors the status of physical disks within a Macintosh machine
 *
 * Communication protocol is SSH
 *
 * Tested on macOS Version 14.5
 *
 * Creates a custom driver table with the following columns: 
 *   - Model: Model name of the disk
 *   - Status: Current status of the disk
 *   - Size: Total size of the disk (in GB)
 *   - Free space: Total free space available on the disk (in GB)
 *   - Usage: Usage percentage of the disk
 *   - Serial Number: The unique serial number assigned to the disk
 *   - Partitions number: Number of partitions belonging to the disk
 *
 **/

// SSH command to retrieve retrieve physical disks information
var cmdGetPhysicalDisks = 'system_profiler SPNVMeDataType SPStorageDataType -json'

var sshConfig = {
  'username': D.device.username(),
  'password': D.device.password(),
  'timeout': 10000
}

// Custom Driver Table to store physical disks information
var table = D.createTable(
  'Physical Disks',
  [
    { label: 'Model', valueType: D.valueType.STRING },
    { label: 'Status', valueType: D.valueType.STRING },
    { label: 'Size', unit: 'GB', valueType: D.valueType.NUMBER },
    { label: 'Free Space', unit: 'GB', valueType: D.valueType.NUMBER },
    { label: 'Usage', unit: '%', valueType: D.valueType.NUMBER },
    { label: 'Serial Number', valueType: D.valueType.STRING },
    { label: 'Partitions Number', valueType: D.valueType.NUMBER }
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
 * @param {string} cmdGetPhysicalDisks The SSH command to execute
 * @returns {Promise} A promise that resolves with the command output or rejects with an error
 */
function executeCommand (cmdGetPhysicalDisks) {
  var d = D.q.defer()
  sshConfig.command = cmdGetPhysicalDisks
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
 * Converts bytes to gigabytes.
 * @param {number} bytes Number of bytes to convert
 * @returns {number} Equivalent number of gigabytes
 */
function bytesToGB(bytes) {
  return (bytes / Math.pow(1024, 3)).toFixed(2)
}

/**
 * Parses the output of the SSH command to extract physical disk information
 * @param {string} output The output from the SSH command execution
 * @returns {Array} An array of objects representing parsed physical disk information
 */
function parseOutput(output) {
  if (output) {
    var parsedData = JSON.parse(output)
    var nvmeData = parsedData.SPNVMeDataType
    var storageData = parsedData.SPStorageDataType
    var disksList = []
    if (nvmeData && Array.isArray(nvmeData) && nvmeData.length > 0) {
      var disksInfo = nvmeData[0]._items
      if (Array.isArray(disksInfo) && disksInfo.length > 0) {
        disksInfo.forEach(function(disk) {
          var sizeInBytes = disk.size_in_bytes || 0
          var totalFreeSpace = 0
          var partitionsNumber = 0
          var filesystemFreeSpace = {}
          var uniqueFilesystems = new Set() 
          if (storageData && Array.isArray(storageData)) {
            storageData.forEach(function(volume) {
              if (volume.physical_drive && volume.physical_drive.device_name === disk.device_model) {
                var fsType = volume.file_system || ''
                if (!uniqueFilesystems.has(fsType)) {
                  uniqueFilesystems.add(fsType)
                  filesystemFreeSpace[fsType] = volume.free_space_in_bytes || 0
                  totalFreeSpace += filesystemFreeSpace[fsType]
                }
                partitionsNumber += 1
              }
            })
          }
          var freeSpaceGB = bytesToGB(totalFreeSpace)
          var totalSizeGB = bytesToGB(sizeInBytes)
          var usedSpaceGB = totalSizeGB - freeSpaceGB
          var usagePercentage = totalSizeGB > 0 ? ((usedSpaceGB / totalSizeGB) * 100).toFixed(2) : 0
          var diskInfo = {
            id: disk.bsd_name,
            name: disk.device_model || 'N/A',
            status: disk.smart_status || 'N/A',
            size: totalSizeGB,
            freeSpace: freeSpaceGB,
            usage: usagePercentage,
            serialNumber: disk.device_serial || 'N/A',
            partitionsNumber: partitionsNumber
          }
          disksList.push(diskInfo)
        })
        populateTable(disksList)
      } else {
        console.error('No Disks found in SPNVMeDataType')
        D.failure(D.errorType.PARSING_ERROR)
      }
    } else {
      console.error('SPNVMeDataType is not available or empty')
      D.failure(D.errorType.PARSING_ERROR)
    }
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

function populateTable (disks) {
  disks.forEach(function(data) {
    table.insertRecord(sanitize(data.id), [
      data.name,
      data.status,
      data.size,
      data.freeSpace,
      data.usage,
      data.serialNumber,
      data.partitionsNumber
    ])
  })
  D.success(table)
}

/**
 * @remote_procedure
 * @label Validate SSH connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate () {
  executeCommand(cmdGetPhysicalDisks)
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
  * @label Get Physical Disks Info
  * @documentation This procedure retrieves information about physiscal disks installed on a Macintosh machine
 */
function get_status () {
  executeCommand(cmdGetPhysicalDisks)
    .then(parseOutput)
    .catch(checkSshError)
}