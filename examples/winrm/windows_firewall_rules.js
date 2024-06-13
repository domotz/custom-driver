/**
 * Domotz Custom Driver 
 * Name: Windows Firewall Rules
 * Description: Show Firewall Rules on a Windows machine
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 * Powershell Version:
 *      - 5.1.19041.2364
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
var firewallFilter = D.getParameter('firewallFilter');

if (firewallFilter.length === 1 && firewallFilter[0].toLowerCase() === 'all') {
    getFirewallRules = 'Get-NetFirewallRule | Select-Object Name, DisplayName, Group, Direction, Action, Enabled | ConvertTo-Json -Compress';
}else{
    var firewallConditions = firewallFilter.map(function(str){return '$_.DisplayName -like "'+str+'"';});
    var firewallFilterExpression = firewallConditions.join(' -or ');    
    getFirewallRules = 'Get-NetFirewallRule | Where-Object {' + firewallFilterExpression + '} | Select-Object Name, DisplayName, Group, Direction, Action, Enabled | ConvertTo-Json -Compress';
}


// Define the WinRM options when running the commands
var winrmConfig = {
    "command": getFirewallRules,
    "username": D.device.username(),
    "password": D.device.password()
};

var directionCodes = {
    "1": "Inbound",
    "2": "Outbound",
};

var actionCodes = {
    "1": "NotConfigured",
    "2": "Allow",
    "3": "Block",
};

var enabledCodes = {
    "1": "Yes",
    "2": "No",
};

// Creation of custom driver table 
var firewallTable = D.createTable(
    "FireWall rules",
    [
        { label: "Name" },
        { label: "Group" },
        { label: "Direction" },
        { label: "Action" },
        { label: "Enabled" }
    ]
);


// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    winrmConfig.command = "Get-NetFirewallRule";
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            D.success();
        } else {
            checkWinRmError(output.error);
        }
    });
}

/**
 * @remote_procedure
 * @label Retrieve list of firewall rules
 * @documentation This procedure retrieves a list of firewall rules for the target device
 */
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

function populateTable(id, displayname, group, direction, action, enabled) {
    var recordId = sanitize(id);
    direction = directionCodes[direction];
    action = actionCodes[action];
    enabled = enabledCodes[enabled];
    firewallTable.insertRecord(recordId, [displayname || "N/A", group || "N/A", direction, action, enabled]);
}

/**
 * @description Parses the output of the WinRM command and fill the firewall rules table.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    if (output.error === null) {
        var jsonOutput = JSON.parse(JSON.stringify(output));
        var listOfFirewallRules = [];
        if (!jsonOutput.outcome.stdout) {
            console.log("There are no firewall rules related to this filter.");
        } else {
            var result = JSON.parse(jsonOutput.outcome.stdout);
        }
        if (Array.isArray(result)) {
            listOfFirewallRules = result;
        } else if (typeof result === 'object') {
            listOfFirewallRules.push(result);
        }
        for (var k = 0; k < listOfFirewallRules.length; k++) {
            populateTable(
                listOfFirewallRules[k].Name,
                listOfFirewallRules[k].DisplayName,
                listOfFirewallRules[k].Group,
                listOfFirewallRules[k].Direction,
                listOfFirewallRules[k].Action,
                listOfFirewallRules[k].Enabled
            );
        }
        D.success(firewallTable);
    } else {
        checkWinRmError(output.error);
    }
}