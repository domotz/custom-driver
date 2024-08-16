/**
 * Domotz Custom Driver
 * Name: Windows Static IP Monitor
 * Description: This script retrieves and monitors static IP information for network interfaces on Windows machines.
 *
 * Communication protocol is WinRM
 *
 * Tested on:
 *    - Windows 10
 *    - Windows 11
 *    - Powershell version 5.1.19041.4412
 *
 * Creates a Custom Driver Table with the following columns:
 *    - ID: Unique identifier for each network interface
 *    - IP: IP address assigned to each interface
 *    - Is Static: Indicates whether the IP address is static or dynamic
 *    - Connection State: Current connection status of each interface
 *
 * Privilege required: User
 *
 */
// List of network interfaces aliases to filter
// interfaceAliases: ["Ethernet", "Wi-Fi"] to display network interfaces IPs by a list of aliases
// or
// interfaceAliases = ["All"] to display all network interfaces IPs.
var interfaceAliases = D.getParameter("interfaceAliases");

// WinRM command to retrieve network interfaces by their aliases
var command = generateCmdByAliases(interfaceAliases);

// Define the WinRM options when running the commands
var winRMConfig = {
  username: D.device.username(),
  password: D.device.password()
}

// mapping boolean values to human-readable strings.
var booleanCodes = {
  0: 'No',
  1: 'Yes'
}

// Creation of custom driver table
var table = D.createTable(
    "Network Interfaces",
    [
      { label: 'Ip addresses', valueType: D.valueType.STRING },
      { label: 'Static', valueType: D.valueType.STRING },
      { label: 'Connection State', valueType: D.valueType.STRING }
    ]
);

/**
 * Generates a PowerShell command to retrieve network interface information based on provided interface aliases.
 * @param {Array} interfaceAliases An array of interface aliases to filter network interfaces.
 * @returns {string} A PowerShell command to retrieve network interface information.
 */
function generateCmdByAliases(interfaceAliases) {
  var filter = generateFilterByAliases(interfaceAliases);
  return 'Get-NetIPInterface -AddressFamily IPv4 ' + filter + '| ForEach-Object { [PSCustomObject]@{ InterfaceAlias = $_.InterfaceAlias; DhcpEnabled = $_.Dhcp; ConnectionState = $_.ConnectionState; IPv4Addresses = (Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).IPAddress } } | ConvertTo-Json';
}

/**
 * Generates a PowerShell filter command to filter network interfaces based on provided interface aliases.
 * @param {Array} interfaceAliases An array of interface aliases to filter network interfaces.
 * @returns {string} A PowerShell filter command to filter network interfaces based on the provided aliases.
 */
function generateFilterByAliases(interfaceAliases) {
  if (interfaceAliases.length === 1 && interfaceAliases[0].toLowerCase() === 'all') {
    return ''
  } else {
    var stringAliases = interfaceAliases.map(function (alias) {
      return '"' + alias + '"';
    }).join(', ');
    return '| Where-Object { (' + stringAliases + ') -contains $_.InterfaceAlias } '
  }
}

// Check for Errors on the WinRM command response
function checkWinRmError(err) {
  if (err.message) console.error(err.message);
  if (err.code === 401){
    D.failure(D.errorType.AUTHENTICATION_ERROR);
  } else if (err.code === 404) {
    D.failure(D.errorType.RESOURCE_UNAVAILABLE);
  } else {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
  }
}

// Execute WinRM command
function executeWinRMCommand(command) {
  var d = D.q.defer();
  winRMConfig.command = command;
  D.device.sendWinRMCommand(winRMConfig, function (output) {
    if (output.error === null) {
      d.resolve(output);
    } else {
      d.reject(output.error);
    }
  });
  return d.promise;
}

/**
 * @remote_procedure
 * @label Validate WinRM connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate() {
  executeWinRMCommand("Get-NetIPInterface")
      .then(parseValidateOutput)
      .then(D.success)
      .catch(checkWinRmError);
}

function parseValidateOutput(output) {
  if (output.outcome !== undefined && output.outcome.stdout.trim() !== "") {
    console.info("Validation successful");
  } else {
    console.error("Validation unsuccessful");
  }
}

/**
 * @remote_procedure
 * @label Get static IP for network interfaces
 * @documentation Retrieves and monitors the static IP information for network interfaces on Windows machines.
 */
function get_status() {
  executeWinRMCommand(command)
      .then(parseOutput)
      .catch(checkWinRmError);
}

function sanitize(output){
  var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
  var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
  return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * @description Populates the output table with a new record.
 * The function sanitizes the ID, converts boolean indicators to codes, ips
 * and inserts the record into the table.
 */
function populateTable (id, ips, isStatic, connectionState) {
  var recordId = sanitize(id)
  ips = Array.isArray(ips) ? ips.join(', ' ) : ips;
  isStatic = booleanCodes[isStatic];
  connectionState = booleanCodes[connectionState];
  table.insertRecord(recordId, [ips, isStatic, connectionState])
}

/**
 * @description Parses the output of the WinRM command and fills the output table.
 * @param {object} output - The output object containing network interface information.
 */
function parseOutput (output) {
  if (output.error === null) {
    var jsonOutput = JSON.parse(JSON.stringify(output))
    let listOfIntegrationServices = []
    if (!jsonOutput.outcome.stdout) {
      console.log('There are no network interfaces related to this virtual machine.');
    } else {
      listOfIntegrationServices = JSON.parse(jsonOutput.outcome.stdout)
      if (!Array.isArray(listOfIntegrationServices)) {
        if (typeof (listOfIntegrationServices) === 'object') {
          listOfIntegrationServices = [listOfIntegrationServices];
        }
      }
      if (Array.isArray(listOfIntegrationServices)) {
        if (!listOfIntegrationServices.length) {
          console.log('There are no network interfaces related to this virtual machine.');
        } else {
          for (let k = 0; k < listOfIntegrationServices.length; k++) {
            populateTable(
              listOfIntegrationServices[k].InterfaceAlias,
              listOfIntegrationServices[k].IPv4Addresses,
              listOfIntegrationServices[k].DhcpEnabled,
              listOfIntegrationServices[k].ConnectionState
            )
          }
        }
      }
    }
    D.success(table)
  } else {
    checkWinRmError(output.error)
  }
}