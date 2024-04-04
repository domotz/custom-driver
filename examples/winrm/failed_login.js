/**
 * Domotz Custom Driver 
 * Name: Windows Failed Logon attempts
 * Description: monitors the failed logon on a Windows computer
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver Variable with the number of failed logon and a custom table with a summary of target users
 * 
 * Privilege required: 
 * - Read permissions on HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog\Security
 * - Membership of builtin group "Event Log Readers" 
 * 
**/

var hours = D.getParameter("hours"); // Set the number of hours to look back for failed logon attempts

// Command to retrieve failed login attempts
var winrmCommand = '$Hours=' + hours + ';$events=Get-WinEvent -FilterHashTable @{LogName="Security";ID=4625;StartTime=((Get-Date).AddHours(-($Hours)).Date);EndTime=(Get-Date)} -ErrorAction SilentlyContinue;$GroupByUsers = $events | ForEach-Object {[PSCustomObject]@{TimeCreated = $_.TimeCreated;TargetUserName = $_.properties[5].value;WorkstationName = $_.properties[13].value;IpAddress = $_.properties[19].value }} | Group-Object -Property TargetUserName | Sort-Object -Property Count -Descending;$GroupByUsers |select count,values |ConvertTo-Json';

// Define winrm configuration
var winrmConfig = {
    "command": "",
    "username": D.device.username(),
    "password": D.device.password(),
};

var failedLogonTable = D.createTable(
    "Failed logon attempts by account",
    [
        { label: "last " + hours + " hour(s)" }
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

// Function for executing command. 
function executeCommand(command, outputHandler) {
    winrmConfig.command = command;
    D.device.sendWinRMCommand(winrmConfig, outputHandler);
}

/**
 * Parses the output of a system command that lists failed logon attempts for the last specified number of hours.
 * @param {Object} output The output of the system command, including stdout and an error object.
 */
function parseOutput(output) {
    if (output.error === null) {
        var totFailed = 0;
        if (output.outcome.stdout) {
            var jsonOutput = JSON.parse(output.outcome.stdout);
            for (var i = 0; i < jsonOutput.length; i++) {
                var count = jsonOutput[i].Count;
                var values = jsonOutput[i].Values[0];
                failedLogonTable.insertRecord(values, [count]);
                totFailed += count;
            }
        }
        var totFailedLogon = [D.device.createVariable("FailedLogonAttempts", "Total failed attempts", totFailed, null, D.valueType.NUMBER)];
        D.success(totFailedLogon, failedLogonTable);
    } else {
        console.error(output.error);
        D.failure();
    }
}

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    executeCommand('Get-WinEvent -LogName "Security" -MaxEvents 1', function (output) {
        if (output.error === null) {
            D.success();
        } else {
            checkWinRmError(output.error);
        }
    });
}

/**
* @remote_procedure
* @label Get Host failed logon for the last hours
* @documentation This procedure retrieves last hour failed logon attempts
*/
function get_status() {
    executeCommand(winrmCommand, parseOutput);

}