/**
 * Domotz Custom Driver 
 * Name: Windows Host Users Monitoring
 * Description: Monitors the status of all the existing users on a Windows machine
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Name
 *  - Status
 *  - Description
 * 
**/

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    D.device.sendWinRMCommand({command:"Test-WSMan"}, function (output) {
        if (output.error === null){
            D.success();
        } else {
            console.error(output.error);
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
    });
} 

/**
* @remote_procedure
* @label Get Host Device Users
* @documentation This procedure retrieves the users on the host device and outputs if they are enabled or not
*/
function get_status(){
    D.device.sendWinRMCommand({command:"Get-LocalUser"}, callbackUsers);
}

var hostUsersTable = D.createTable(
    "Host Users",
    [
        { label: "Name" },
        { label: "Status" },
        { label: "Description" }
    ]
);
var userDetailsRegexp = /([\w\d]+)\s+([\w]+)\s+(.*)/;

function callbackUsers(output) {
    if (output.error === null){
        var outputLines = output.outcome.stdout.split(/\r?\n/).slice(1);
        for (var i = 1; i < outputLines.length; i++) {
            var line = outputLines[i];
            if (line !== ""){
                var match = line.match(userDetailsRegexp);
                if (match){
                    var name = match[1];
                    var recordId = name.toLowerCase().substring(0, 50);
                    var status = match[2];
                    var description = match[3];
                    hostUsersTable.insertRecord(recordId, [name, status, description]);
                }
            }
        }
        D.success(hostUsersTable);
    } else {
        console.error(output.error);
        D.failure();
    }
}
