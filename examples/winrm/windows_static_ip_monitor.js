/**
 * Domotz Custom Driver
 * Name: Windows Static IP Monitor
 * Description: This script retrieves and monitors static IP information for network interfaces on Windows machines.
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Tested on:
 *    - Windows 10
 *    - Windows 11
 *
 * PowerShell version 5.1.19041.4412
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
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
const interfaceAliases = D.getParameter("interfaceAliases");

// WinRM command to retrieve network interfaces by their aliases
const command = generateCmdByAliases(interfaceAliases);

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// Define the WinRM options when running the commands
const config = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
}

// mapping boolean values to human-readable strings.
const booleanCodes = {
    0: 'No',
    1: 'Yes'
}

// Creation of custom driver table
const table = D.createTable(
    "Network Interfaces",
    [
        {label: 'Ip addresses', valueType: D.valueType.STRING},
        {label: 'Static', valueType: D.valueType.STRING},
        {label: 'Connection State', valueType: D.valueType.STRING}
    ]
);

/**
 * Generates a PowerShell command to retrieve network interface information based on provided interface aliases.
 * @param {Array} interfaceAliases An array of interface aliases to filter network interfaces.
 * @returns {string} A PowerShell command to retrieve network interface information.
 */
function generateCmdByAliases(interfaceAliases) {
    const filter = generateFilterByAliases(interfaceAliases);
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
        const stringAliases = interfaceAliases.map(function (alias) {
            return '"' + alias + '"';
        }).join(', ');
        return '| Where-Object { (' + stringAliases + ') -contains $_.InterfaceAlias } '
    }
}

function parseValidateOutput(isValidated) {
    if (isValidated) {
        console.info("Validation successful");
        D.success();
    } else {
        console.error("Validation unsuccessful");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute WinRM command
function executeWinRMCommand(command) {
    const d = D.q.defer();
    config.command = command;
    D.device.sendWinRMCommand(config, function (output) {
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
    instance.executeCommand("Get-NetIPInterface")
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get static IP for network interfaces
 * @documentation Retrieves and monitors the static IP information for network interfaces on Windows machines.
 */
function get_status() {
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * @description Populates the output table with a new record.
 * The function sanitizes the ID, converts boolean indicators to codes, ips
 * and inserts the record into the table.
 */
function populateTable(service) {
    const id = service.InterfaceAlias
    const ips = Array.isArray(service.IPv4Addresses) ? service.IPv4Addresses.join(', ') : service.IPv4Addresses;
    const isStatic = booleanCodes[service.DhcpEnabled]
    const connectionState = booleanCodes[service.ConnectionState]
    const recordId = sanitize(id)
    table.insertRecord(recordId, [ips, isStatic, connectionState])
}

/**
 * @description Parses the output of the WinRM command and fills the output table.
 * @param listOfIntegrationServices
 */
function parseOutput(listOfIntegrationServices) {
    if (listOfIntegrationServices) {
        if (Array.isArray(listOfIntegrationServices)) {
            for (let k = 0; k < listOfIntegrationServices.length; k++) {
                populateTable(listOfIntegrationServices[k])
            }
        } else {
            populateTable(listOfIntegrationServices)
        }
    } else {
        console.log('There are no network interfaces related to this virtual machine.');
    }
    D.success(table)
}

// WinRM functions
function WinRMHandler() {}

// Check for Errors on the command response
WinRMHandler.prototype.checkError = function (output) {
    if (output.message) console.error(output.message);
    if (output.code === 401) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (output.code === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(output);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute command
WinRMHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    config.command = command;
    D.device.sendWinRMCommand(config, function (output) {
        if (output.error) {
            self.checkError(output);
            d.reject(output.error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

WinRMHandler.prototype.parseOutputToJson = function (output) {
    const jsonString = output.outcome.stdout
    return jsonString ? JSON.parse(jsonString) : null;
}

WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout
}

// SSH functions
function SSHHandler() {}

// Check for Errors on the command response
SSHHandler.prototype.checkError = function (output, error) {
    if (error) {
        if (error.message) console.error(error.message);
        if (error.code === 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
        if (error.code === 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

SSHHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    const self = this;
    config.command = 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
    D.device.sendSSHCommand(config, function (output, error) {
        if (error) {
            self.checkError(output, error);
            d.reject(error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

SSHHandler.prototype.parseOutputToJson = function (output) {
    return JSON.parse(output);
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}