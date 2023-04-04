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


var hours = 1;


var winrmConfig = {
    "command": '',
    "username": D.device.username(),
    "password": D.device.password()
};

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
* @label Get Host failed logon for the last hours
* @documentation This procedure retrieves last hour failed logon attempts
*/
function get_status() {
    winrmConfig.command = '$Hours=' + hours + ';$events=Get-WinEvent -FilterHashTable @{LogName="Security";ID=4625;StartTime=((Get-Date).AddHours(-($Hours)).Date);EndTime=(Get-Date)} -ErrorAction SilentlyContinue;$GroupByUsers = $events | ForEach-Object {[PSCustomObject]@{TimeCreated = $_.TimeCreated;TargetUserName = $_.properties[5].value;WorkstationName = $_.properties[13].value;IpAddress = $_.properties[19].value }} | Group-Object -Property TargetUserName | Sort-Object -Property Count -Descending;$GroupByUsers |select count,values |ConvertTo-Json'
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

var failedLoginTable = D.createTable(
    "Failed logon attempts by account",
    [

        { label: "last " + hours + " hour(s)" }

    ]
);

function parseOutput(output) {
    if (output.error === null) {
        var jsonOutput = JSON.parse(JSON.stringify(output));
        jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
        var k = 0;
        var totFailed = 0;
        while (k < jsonOutput.length) {
            failedLoginTable.insertRecord(jsonOutput[k].Values[0], [jsonOutput[k].Count]);
            totFailed += jsonOutput[k].Count;
            k++
        }
        var totFailedLogon = [D.createVariable('FailedLogonAttempts', 'Total failed attempts', totFailed, null, D.valueType.NUMBER)];
        D.success(totFailedLogon, failedLoginTable);
    } else {
        console.error(output.error);
        D.failure();
    }

}