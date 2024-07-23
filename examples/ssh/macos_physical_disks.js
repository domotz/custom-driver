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
 *   - Media Type: Type of the disk media
 *   - Partitions number: Number of partitions belonging to the disk
 *
 **/

// SSH command to retrieve retrieve physical disks information
var cmdGetPhysicalDisks = 'diskutil info -all'

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
    { label: 'Media Type', valueType: D.valueType.STRING },
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
 * Parses the output of the SSH command to extract physical disk information
 * @param {string} output The output from the SSH command execution
 * @returns {Array} An array of objects representing parsed physical disk information
 */
function parseOutput(output) {
  var lines = output.trim().split('\n')
  var physicalDisks = []
  var currentDisk = {}

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i]
    if (line === '' || line.indexOf('**********') === 0) {
      continue
    }
    var match = line.match(/^(.*?):\s*(.*)$/)
    if (match) {
      var key = match[1].trim()
      var value = match[2].trim()
      if (key === 'Device Identifier') {
        if (Object.keys(currentDisk).length > 0) {
          physicalDisks.push(currentDisk);
        }
        currentDisk = { 'Device Identifier': value }
      } else {
        if (!currentDisk) {
          continue
        }
        currentDisk[key] = value
      }
    }
  }
  if (Object.keys(currentDisk).length > 0) {
    physicalDisks.push(currentDisk)
  }
  var filteredDisks = physicalDisks.filter(function(disk) {
    return disk['Whole'] === 'Yes'
  });

  filteredDisks.forEach(function(disk) {
    var partitionsCount = 0
    var totalUsedSpace = 0
    var diskIdentifier = disk['Device Identifier']
    for (var j = 0; j < physicalDisks.length; j++) {
      var partition = physicalDisks[j]
      if (partition !== disk && partition['Part of Whole'] === diskIdentifier && partition['This disk is an APFS Volume Snapshot.  APFS Information'] === undefined) {
        partitionsCount++;
        if (partition['Volume Used Space'] && partition['Volume Used Space'].match(/\((\d+) Bytes\)/)) {
          var volumeUsedSpace = parseInt(partition['Volume Used Space'].match(/\((\d+) Bytes\)/)[1])
          totalUsedSpace += volumeUsedSpace
        }
      }
    }

    disk['Partitions Number'] = partitionsCount || 0
    disk['Total Used Space'] = totalUsedSpace || 0
  })
  return filteredDisks
}

function sanitize (output) {
  var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
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
 * Extracts relevant variables from parsed physical disks and populates the table
 * @param {Array} physicalDisks Array of objects representing parsed physical disk information
 */
function extractVariables(physicalDisks) {
  var disksList = []
  physicalDisks.forEach(function (disk) {
    var diskSize = parseFloat(disk['Disk Size'] ? disk['Disk Size'].replace(/^\D*([\d.]+).*/, '$1') : 0)
    var usedSpace = disk['Total Used Space'] ? bytesToGB(disk['Total Used Space']) : 0
    var usage = diskSize !== 0 ? (usedSpace / diskSize) * 100 : 0
    var disks = {
      id: disk['Device Identifier'],
      name: disk['Device / Media Name'] || 'N/A',
      status: disk['SMART Status'] || 'N/A',
      size: diskSize,
      freeSpace : (diskSize - usedSpace).toFixed(2),
      usage: usage,
      mediaType: disk['Media Type'] || 'N/A',
      partitionsNumber: disk['Partitions Number'] 
    }
    disksList.push(disks)
  })
  populateTable(disksList)
}

function populateTable (disks) {
  disks.forEach(function(data) {
    table.insertRecord(sanitize(data.id), [
      data.name,
      data.status,
      data.size,
      data.freeSpace,
      data.usage,
      data.mediaType,
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
    .then(extractVariables)
    .catch(checkSshError)
}