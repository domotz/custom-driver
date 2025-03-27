/**
 * Domotz Custom Driver
 * Name: Windows Audit Settings Monitoring
 * Description: Monitors the audit settings on Windows
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 * Creates a Custom Driver table with audit subcategories and their settings
 *
 * Privilege required:
 * - Read permissions on HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog\Security
 * - Membership of builtin group "Event Log Readers"
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * References : https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/dn452415(v=ws.11)
 *
 **/

/** List of subcategories you want to monitor
 *
 * To Monitor all settings:
 *
 * const filter = ["Security System Extension",
 * "System Integrity",
 * "IPsec Driver",
 * "Other System Events",
 * "Security State Change",
 * "Logon",
 * "Logoff",
 * "Account Lockout",
 * "IPsec Main Mode",
 * "IPsec Quick Mode",
 * "IPsec Extended Mode",
 * "Special Logon",
 * "Other Logon/Logoff Events",
 * "Network Policy Server",
 * "User / Device Claims",
 * "Group Membership ",
 * "File System",
 * "Registry",
 * "Kernel Object",
 * "SAM",
 * "Certification Services",
 * "Application Generated",
 * "Handle Manipulation",
 * "File Share",
 * "Filtering Platform Packet Drop",
 * "Filtering Platform Connection ",
 * "Other Object Access Events",
 * "Detailed File Share",
 * "Removable Storage",
 * "Central Policy Staging",
 * "Non Sensitive Privilege Use",
 * "Other Privilege Use Events",
 * "Sensitive Privilege Use",
 * "Process Creation",
 * "Process Termination",
 * "DPAPI Activity",
 * "RPC Events",
 * "Plug and Play Events",
 * "Token Right Adjusted Events",
 * "Audit Policy Change",
 * "Authentication Policy Change",
 * "Authorization Policy Change",
 * "MPSSVC Rule-Level Policy Change",
 * "Filtering Platform Policy Change",
 * "Other Policy Change Events",
 * "Computer Account Management",
 * "Security Group Management",
 * "Distribution Group Management",
 * "Application Group Management",
 * "Other Account Management Events",
 * "User Account Management",
 * "Directory Service Access",
 * "Directory Service Changes",
 * "Directory Service Replication",
 * "Detailed Directory Service Replication",
 * "Kerberos Service Ticket Operations",
 * "Other Account Logon Events",
 * "Kerberos Authentication Service",
 * "Credential Validation"]
 *
 * Suggested settings to monitor:
 *["Security System Extension",
 *   "Logon",
 *   "SAM",
 *   "Audit Policy Change",
 *   "Authentication Policy Change",
 *   "MPSSVC Rule-Level Policy Change",
 *   "Computer Account Management",
 *   "Security Group Management",
 *   "User Account Management",
 *   "Directory Service Changes",
 *   "Directory Service Replication"]
 *
 */

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

const config = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

let filter = [
    "Security System Extension",
    "Logon",
    "SAM",
    "Audit Policy Change",
    "Authentication Policy Change",
    "MPSSVC Rule-Level Policy Change",
    "Computer Account Management",
    "Security Group Management",
    "User Account Management",
    "Directory Service Changes",
    "Directory Service Replication"
];

filter = '@("' + filter.join('","') + '")';

const auditTable = D.createTable(
    "Audit Settings",
    [
        {label: "Category"},
        {label: "Subcategory"},
        {label: "Setting"}
    ]
);

function parseValidateOutput (isValidated) {
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
 * @label Validate is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    instance.executeCommand('Get-WinEvent -LogName "Security" -MaxEvents 1')
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Audit Settings
 * @documentation This procedure retrieves and filter the current audit settings
 */
function get_status() {
    const command = "$output = auditpol /get /category:* | Where-Object { $_ -match '\\S' };$output = $output -replace '(?<=\\S)\\s{2,}(?=\\S)', ',';$aOutput = $output -split '\\r?\\n';$aOutput = $aOutput[2..($aOutput.Length - 1)];$CurrCategory = '';$RetObj = [System.Collections.ArrayList]::new();foreach ($item in $aOutput){if ($item -match '^\\s'){$tobj = @{category = $CurrCategory;subcat = (($item.split(','))[0]).Trim();setting = ($item.split(','))[1]};$RetObj += $tobj}elseif ($item -match '^(\\S)') {$CurrCategory = $item}};$RetObj |?{" + filter + " -contains $_.subcat}|ConvertTo-Json"
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    const recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * Parses the output of the audit tool and inserts the audit results into the audit table.
 * @param jsonOutput The output of the audit tool.
 */
function parseOutput(jsonOutput) {
    let k = 0;
    if (jsonOutput) {
        while (k < jsonOutput.length) {
            const category = jsonOutput[k].category;
            const subcategory = jsonOutput[k].subcat;
            const setting = jsonOutput[k].setting;
            const recordId = sanitize(category + " " + subcategory);
            auditTable.insertRecord(recordId, [category, subcategory, setting]);
            k++;
        }
    } else {
        console.error("No data was collected");
        D.failure(D.errorType.PARSING_ERROR);
    }
    D.success(auditTable);
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
    return JSON.parse(output.outcome.stdout);
}


WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout
}

// SSH functions
function SSHHandler() {
}

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