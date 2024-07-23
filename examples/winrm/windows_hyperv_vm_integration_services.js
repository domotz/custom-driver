/**
 * Domotz Custom Driver
 * Name: Windows Hyper-V VM Integration Services
 * Description: This script retrieves information about the Hyper-V VM Integration Services
 *
 * Communication protocol is WinRM
 *
 * Tested on:
 *    - Windows 10
 *    - Windows Server 2019
 *    - Hyper-V 10.0.19041.1
 *    - Powershell version 5.1.19041.4412
 *
 * Creates a Custom Driver table with the following columns:
 *    - Name: User-friendly name of the integration service.
 *    - Enabled: Indicates if the service is enabled (Yes) or disabled (No).
 * Privilege required:
 *    - Hyper-V Administrators
 *
 */

// The VM ID for which you want to display the Integration Services.
const vmIdFilter = D.getParameter('vmId')

// WinRM command to retrieve VM Integration Services
const getVmIntegrationServices = 'Get-VMIntegrationService -vm (get-vm -id "' + vmIdFilter + '")  | select-object id, name, enabled | ConvertTo-json'

// Define the WinRM options when running the commands
const winrmConfig = {
  command: getVmIntegrationServices,
  username: D.device.username(),
  password: D.device.password()
}

const booleanCodes = {
  true: 'Yes',
  false: 'No'
}

// Creation of custom Integration Services table
const integrationServicesTable = D.createTable(
  'integration services',
  [
    { label: 'Name' },
    { label: 'Enabled' }
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
 * @label Retrieve list of VM integration services
 * @documentation This procedure retrieves a list of integration services for the target virtual Machine
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
 * @description Extracts the integration service ID from the given input string.
 * If the input contains a backslash ('\\'), it returns the substring after the last backslash.
 * Otherwise, it returns the entire input.
 * @param {string} input - The input string to extract the integration service ID from.
 * @returns {string} - The extracted integration service ID or the original input string.
 */
function extractNetworkAdaptersId (input) {
  if (input.indexOf('\\') !== -1) {
    return input.split('\\').pop()
  } else {
    return input
  }
}

/**
 * @description Populates the integration services table with a new record.
 * The function sanitizes the ID, converts boolean indicators to codes, ensures the PoolName is not empty,
 * and inserts the record into the table
 */
function populateTable (id, Name, Enabled) {
  const recordId = sanitize(extractNetworkAdaptersId(id))
  Enabled = booleanCodes[Enabled]
  Name = Name || 'N/A'
  integrationServicesTable.insertRecord(recordId, [Name, Enabled])
}

/**
 * @description Parses the output of the WinRM command and fill the integration services table.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput (output) {
  if (output.error === null) {
    const jsonOutput = JSON.parse(JSON.stringify(output))
    let listOfIntegrationServices = []
    let result = null
    if (!jsonOutput.outcome.stdout) {
      console.log('There are no integration services related to this virtual machine.')
    } else {
      result = JSON.parse(jsonOutput.outcome.stdout)
    }
    if (Array.isArray(result)) {
      listOfIntegrationServices = result
    } else if (typeof result === 'object') {
      listOfIntegrationServices.push(result)
    }
    for (let k = 0; k < listOfIntegrationServices.length; k++) {
      populateTable(
        listOfIntegrationServices[k].Id,
        listOfIntegrationServices[k].Name,
        listOfIntegrationServices[k].Enabled
      )
    }
    D.success(integrationServicesTable)
  } else {
    checkWinRmError(output.error)
  }
}
