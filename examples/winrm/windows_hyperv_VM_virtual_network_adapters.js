/**
 * Domotz Custom Driver
 * Name: Windows Hyper-V VM Virtual Network Adapters
 * Description: This script retrieves information about the Hyper-V VM Virtual Network Adapters
 *
 * Communication protocol is WinRM
 *
 * Tested on Windows Versions:
 *      - Windows 10
 *
 * Powershell Version:
 *      - 5.1.19041.2364
 *
 * Creates a Custom Driver table with the following columns:
 *    - Name: User-friendly name of the network adapter.
 *    - ClusterMonitored: Indicates if the adapter is monitored by the cluster (Yes or No).
 *    - PoolName: Name of the network pool to which the adapter belongs.
 *    - Connected: Indicates if the adapter is currently connected (Yes or No).
 *    - SwitchName: Name of the virtual switch connected to the adapter.
 *    - BandwidthPercentage: Percentage of bandwidth allocated to the adapter.
 *    - IsDeleted: Indicates if the adapter has been deleted (Yes or No).
 *
 * Privilege required:
 *    - Administrator
 *
 */

// The VM ID for which you want to display the Virtual Network Adapters.
const vmIdFilter = D.getParameter('vmId')

// WinRM command to retrieve VM Virtual Network Adapters
const getVmVirtualNetworkAdapters = '(Get-VM -id "' + vmIdFilter + '" | Select-Object -ExpandProperty NetworkAdapters).ForEach( { @{ "Id" = $_.Id; "Name" = $_.Name; "ClusterMonitored" = $_.ClusterMonitored; "PoolName" = $_.PoolName; "Connected" = $_.Connected; "SwitchName" = $_.SwitchName; "BandwidthPercentage" = $_.BandwidthPercentage; "IsDeleted" = $_.IsDeleted } }) | ConvertTo-Json'

// Define the WinRM options when running the commands
const winrmConfig = {
  command: getVmVirtualNetworkAdapters,
  username: D.device.username(),
  password: D.device.password()
}

const booleanCodes = {
  true: 'Yes',
  false: 'No'
}

// Creation of custom virtual Network Adapters table
const virtualNetworkAdaptersTable = D.createTable(
  'Virtual network adapters',
  [
    { label: 'Name' },
    { label: 'Switch Name' },
    { label: 'Pool' },
    { label: 'Cluster Monitored' },
    { label: 'Connected' },
    { label: 'Bandwidth Percentage' },
    { label: 'Deleted' }
  ]
)

// Check for Errors on the WinRM command response
function checkWinRmError (err) {
  if (err.message) console.error(err.message)
  if (err.code === 401) D.failure(D.errorType.AUTHENTICATION_ERROR)
  if (err.code === 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE)
  console.error(err)
  D.failure(D.errorType.GENERIC_ERROR)
}

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate () {
  winrmConfig.command = 'Get-vm'
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
 * @label Retrieve list of VM virtual network adapters
 * @documentation This procedure retrieves a list of virtual network adapters for the target virtual Machine
 */
function get_status () {
  D.device.sendWinRMCommand(winrmConfig, parseOutput)
}

/**
 * @description Sanitizes the given output string by removing reserved words and special characters,
 * limiting its length to 50 characters, replacing spaces with hyphens, and converting it to lowercase.
 * @param {string} output - The string to be sanitized.
 * @returns {string} - The sanitized string.
 */
function sanitize (output) {
  const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history']
  const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g')
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase()
}

/**
 * @description Extracts the network adapter ID from the given input string.
 * If the input contains a backslash ('\\'), it returns the substring after the last backslash.
 * Otherwise, it returns the entire input.
 * @param {string} input - The input string to extract the network adapter ID from.
 * @returns {string} - The extracted network adapter ID or the original input string.
 */
function extractNetworkAdaptersId (input) {
  if (input.indexOf('\\') !== -1) {
    return input.split('\\').pop()
  } else {
    return input
  }
}

/**
 * @description Populates the virtual network adapters table with a new record.
 * The function sanitizes the ID, converts boolean indicators to codes, ensures the PoolName is not empty,
 * and inserts the record into the table
 */
function populateTable (id, Name, SwitchName, PoolName, ClusterMonitored, Connected, BandwidthPercentage, IsDeleted) {
  const recordId = sanitize(extractNetworkAdaptersId(id))
  ClusterMonitored = booleanCodes[ClusterMonitored]
  Connected = booleanCodes[Connected]
  IsDeleted = booleanCodes[IsDeleted]
  PoolName = PoolName || 'N/A'
  virtualNetworkAdaptersTable.insertRecord(recordId, [Name, SwitchName, PoolName, ClusterMonitored, Connected, BandwidthPercentage, IsDeleted])
}

/**
 * @description Parses the output of the WinRM command and fill the virtual network adapters table.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput (output) {
  if (output.error === null) {
    const jsonOutput = JSON.parse(JSON.stringify(output))
    let listOfVirtualNetworkAdapters = []
    let result = null
    if (!jsonOutput.outcome.stdout) {
      console.log('There are no virtual network adapters related to this virtual machine.')
    } else {
      result = JSON.parse(jsonOutput.outcome.stdout)
    }
    if (Array.isArray(result)) {
      listOfVirtualNetworkAdapters = result
    } else if (typeof result === 'object') {
      listOfVirtualNetworkAdapters.push(result)
    }
    for (let k = 0; k < listOfVirtualNetworkAdapters.length; k++) {
      populateTable(
        listOfVirtualNetworkAdapters[k].Id,
        listOfVirtualNetworkAdapters[k].Name,
        listOfVirtualNetworkAdapters[k].SwitchName,
        listOfVirtualNetworkAdapters[k].PoolName,
        listOfVirtualNetworkAdapters[k].ClusterMonitored,
        listOfVirtualNetworkAdapters[k].Connected,
        listOfVirtualNetworkAdapters[k].BandwidthPercentage,
        listOfVirtualNetworkAdapters[k].IsDeleted
      )
    }
    D.success(virtualNetworkAdaptersTable)
  } else {
    checkWinRmError(output.error)
  }
}
