/**
 * Domotz Custom Driver
 * Name: Windows Firewall Rules
 * Description: Show Firewall Rules on a Windows machine
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Tested on Windows Versions:
 *      - Windows 10
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates a Custom Driver table with the following columns:
 *    - Name: User-friendly name for display purposes.
 *    - Group: The group to which the firewall rule belongs.
 *    - Direction: The direction of network traffic monitored by the firewall rule.
 *    - Action: The action taken when the firewall rule is triggered.
 *    - Enabled: Indicates if the firewall rule is enabled (Yes) or disabled (No).
 * Privilege required:
 *    - Administrator
 */

// List of firewall rules Display Name you want to show 
// firewallFilter = ["Skype", "AnyDesk"] to display firewall rules related to Skype and AnyDesk
// or
// firewallFilter = ["All"] to display all firewall rules.
const firewallFilter = D.getParameter('firewallFilter');

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

if (firewallFilter.length === 1 && firewallFilter[0].toLowerCase() === 'all') {
    getFirewallRules = 'Get-NetFirewallRule | Select-Object Name, DisplayName, Group, Direction, Action, Enabled | ConvertTo-Json -Compress';
}else{
    const firewallConditions = firewallFilter.map(function(str){return '$_.DisplayName -like "'+str+'"';});
    const firewallFilterExpression = firewallConditions.join(' -or ');
    getFirewallRules = 'Get-NetFirewallRule | Where-Object {' + firewallFilterExpression + '} | Select-Object Name, DisplayName, Group, Direction, Action, Enabled | ConvertTo-Json -Compress';
}


// Define the WinRM options when running the commands
const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

const directionCodes = {
    "1": "Inbound",
    "2": "Outbound",
};

const actionCodes = {
    "1": "NotConfigured",
    "2": "Allow",
    "3": "Block",
};

const enabledCodes = {
    "1": "Yes",
    "2": "No",
};

// Creation of custom driver table 
const firewallTable = D.createTable(
    "FireWall rules",
    [
        { label: "Name" },
        { label: "Group" },
        { label: "Direction" },
        { label: "Action" },
        { label: "Enabled" }
    ]
);

function parseValidateOutput(isValidated) {
    if (isValidated) {
        console.info("Validation successful");
        D.success();
    } else {
        console.error("Validation unsuccessful");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    const command = "Get-NetFirewallRule";
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Retrieve list of firewall rules
 * @documentation This procedure retrieves a list of firewall rules for the target device
 */
function get_status() {
    instance.executeCommand(getFirewallRules)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

function sanitize(output){
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

function populateTable(row) {
    const recordId = sanitize(row.Name)
    const displayName = row.DisplayName
    const group = row.Group
    const direction = directionCodes[row.Direction]
    const action = actionCodes[row.Action]
    const enabled = enabledCodes[row.Enabled]
    firewallTable.insertRecord(recordId, [displayName || "N/A", group || "N/A", direction, action, enabled]);
}

/**
 * @description Parses the output of the WinRM command and fill the firewall rules table.
 * @param listOfFirewallRules - The output of the WinRM command.
 */
function parseOutput(listOfFirewallRules) {
    if (listOfFirewallRules) {
        if (Array.isArray(listOfFirewallRules)) {
            for (let k = 0; k < listOfFirewallRules.length; k++) {
                populateTable(listOfFirewallRules[k]);
            }
        } else if (typeof listOfFirewallRules === 'object') {
            populateTable(listOfFirewallRules);
        }
    }else{
        console.log("There are no firewall rules related to this filter.");
    }
    D.success(firewallTable);
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
    return output ? JSON.parse(output) : null;
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}