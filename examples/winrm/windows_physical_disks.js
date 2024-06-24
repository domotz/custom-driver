/**
 * Domotz Custom Driver
 * Name: Windows Physical Disks
 * Description: Monitors the status of physical disks within a Windows machine.
 *
 * Communication protocol is WinRM
 *
 * Tested on Windows Version
 *  - Windows 11
 *
 * Powershell Version:
 *  - 5.1.21996.1
 *
 * Creates a Custom Driver Table with the following columns:
 *    - Model: The model of the physical disk
 *    - Status: The current status of the disk
 *    - Size: The total size of the disk
 *    - Media Type: The type of media the disk uses
 *    - Serial Number: The unique serial number assigned to the disk
 *    - Partitions: The number of partitions present on the disk
 *
 * Privilege required: AD User
 *
 */

var winrmConfig = {
    command: 'Get-CimInstance Win32_DiskDrive | ForEach-Object { $partitions = Get-Partition -DiskNumber $_.index; $totalSize = [math]::Round($_.Size / 1GB, 2); $freeSpace = 0; foreach ($partition in $partitions) { $volume = Get-Volume -Partition $partition; if ($volume) { $freeSpace += $volume.SizeRemaining; } } $freeSpace = [math]::Round($freeSpace / 1GB, 2); $usedSpace = $totalSize - $freeSpace; $usagePercentage = if ($totalSize -ne 0) { [math]::round(($usedSpace / $totalSize) * 100, 2) } else { 0 }; @{ID = $_.DeviceID; Model = $_.Model; Status = $_.Status; Size = $totalSize; MediaType = $_.MediaType; SerialNumber = $_.SerialNumber; PartitionsCount = $partitions.Count; UsagePercentage = $usagePercentage; FreeSpace = $freeSpace;}} | ConvertTo-Json',
    username: D.device.username(),
    password: D.device.password()
  }
  
  // Custom Driver Table to store physical disk information
  var table = D.createTable(
    'Physical Disks',
    [
      { label: 'Model', valueType: D.valueType.STRING },
      { label: 'Status', valueType: D.valueType.STRING },
      { label: 'Size', unit: 'GiB', valueType: D.valueType.NUMBER },
      { label: 'Free Space', unit: 'GiB', valueType: D.valueType.NUMBER },
      { label: 'Usage', unit: '%', valueType: D.valueType.NUMBER },
      { label: 'Media Type', valueType: D.valueType.STRING },
      { label: 'Serial Number', valueType: D.valueType.STRING },
      { label: 'Partitions', valueType: D.valueType.NUMBER }
    ]
  )
  
  // Check for Errors on the WinRM command response
  function checkWinRmError (err) {
    if (err.message) console.error(err.message)
    if (err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR)
    if (err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    console.error(err)
    D.failure(D.errorType.GENERIC_ERROR)
  }
  
  /**
  * @remote_procedure
  * @label Validate WinRM connectivity with the device
  * @documentation This procedure is used to validate the driver and credentials provided during association.
  */
  function validate () {
    D.device.sendWinRMCommand(winrmConfig, function (output) {
      if (output.error === null) {
        D.success()
      } else {
        checkWinRmError(output.error)
      }
    })
  }
  
  /**
  * @remote_procedure
  * @label Get Physical Disks Info
  * @documentation This procedure retrieves information about physiscal disks installed on a Windows machine
  */
  function get_status () {
    D.device.sendWinRMCommand(winrmConfig, parseOutput)
  }
  
  function sanitize (output) {
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
  }
  
  // Parse the output of WinRM commands and insert it into the table
  function parseOutput (output) {
    if (output.error === null) {
      var physicalDisks = Array.isArray(output.outcome.stdout) ? JSON.parse(output.outcome.stdout) : [JSON.parse(output.outcome.stdout)]
  
      physicalDisks.forEach(function (disk) {
        var id = disk.ID || 'N/A'
        var model = disk.Model || 'N/A'
        var status = disk.Status || 'N/A'
        var size = disk.Size || 'N/A'
        var freeSpace = disk.FreeSpace || 'N/A'
        var usagePercentage = disk.UsagePercentage || 'N/A'
        var mediaType = disk.MediaType || 'N/A'
        var serialNumber = disk.SerialNumber || 'N/A'
        var partitions = disk.PartitionsCount || 'N/A'
        var recordId = sanitize(id)
  
        table.insertRecord(recordId, [model, status, size, freeSpace, usagePercentage, mediaType, serialNumber, partitions])
      })
  
      D.success(table)
    } else {
      console.error(output.error)
      checkWinRmError(output.error)
    }
  }