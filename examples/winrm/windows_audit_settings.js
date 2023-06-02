/**
 * Domotz Custom Driver 
 * Name: Windows Audit Settings Monitoring
 * Description: Monitors the audit settings on Windows
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with audit subcategories and their settings
 * 
 * Privilege required: 
 * - Read permissions on HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog\Security
 * - Membership of builtin group "Event Log Readers" 
 * 
 * 
 * References : https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2012-r2-and-2012/dn452415(v=ws.11)
 * 
**/

/** List of subcategories you want to monitor
 * 
 * To Monitor all settings:
 * 
 * var filter = ["Security System Extension",
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

var winrmConfig = {
    username: D.device.username(),
    password: D.device.password()
};

var filter = [
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

var auditTable = D.createTable(
    "Audit Settings",
    [
        { label: "Audit Name" },
        { label: "Category" },
        { label: "Subcategory" },
        { label: "Setting" }
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
    winrmConfig.command = 'Get-WinEvent -LogName "Security" -MaxEvents 1';
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
* @label Get Audit Settings
* @documentation This procedure retrieves and filter the current audit settings
*/
function get_status() {
    winrmConfig.command = "$output = auditpol /get /category:* | Where-Object { $_ -match '\\S' };$output = $output -replace '(?<=\\S)\\s{2,}(?=\\S)', ',';$aOutput = $output -split '\\r?\\n';$aOutput = $aOutput[2..($aOutput.Length - 1)];$CurrCategory = '';$RetObj = [System.Collections.ArrayList]::new();foreach ($item in $aOutput){if ($item -match '^\\s'){$tobj = @{category = $CurrCategory;subcat = (($item.split(','))[0]).Trim();setting = ($item.split(','))[1]};$RetObj += $tobj}elseif ($item -match '^(\\S)') {$CurrCategory = $item}};$RetObj |?{" + filter + " -contains $_.subcat}|ConvertTo-Json";
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

/**
 * Parses the output of the audit tool and inserts the audit results into the audit table.
 * @param {Object} output The output of the audit tool.
 */

function parseOutput(output) {
    if (output.error === null) {
        var k = 0;
        var category;
        var subcategory;
        var setting;
        var auditName;
        var recordId;
        var jsonOutput = JSON.parse(JSON.stringify(output));
        jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
        if (jsonOutput) {
            while (k < jsonOutput.length) {
                category = jsonOutput[k].category;
                subcategory = jsonOutput[k].subcat;
                setting = jsonOutput[k].setting;
                auditName = (category + "_" + subcategory).replace(" ", "_");
                recordId = D.crypto.hash(auditName, "sha256", null, "hex").toLowerCase().slice(0, 50);
                auditTable.insertRecord(recordId, [auditName, category, subcategory, setting]);
                k++;
            }
        } else {
            console.error("No data was collected");
            D.failure(D.errorType.PARSING_ERROR);
        }
        D.success(auditTable);
    } else {
        console.error(output.error);
        D.failure();
    }
}