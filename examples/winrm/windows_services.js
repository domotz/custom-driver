/**
 * Domotz Custom Driver 
 * Name: Windows Services Monitoring
 * Description: Monitors the status of services on a Windows machine
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver table with a list of services, their status and their start type
 * 
 * Privilege required: Local Administrator
* 
**/

// List of services you want to monitor, note that you can put the DisplayName or the ServiceName  

// This is an example of the filter which suit a Windows 10 computer (workstation):
// var svcFilter = '@("bits","Dnscache","Spooler","schedule","DHCP Client")'
 
// For a server you may want to set the filter as follow :
var svcFilter = '@("LanmanServer","dnscache","Windows Time","dhcp","schedule","RpcEptMapper","MpsSvc")'
 
// If you want to list ALL services just put '$null' as a filter 
// var svcFilter = '$null';


/** Some services have a long DisplayName that may cause a problem with the Domotz Table,
 *  you can use the ServiceName instead setting to false the variable useDisplayName
**/
var useDisplayName = false;

var getServices = svcFilter + '|Get-Service|Select-Object ServiceName,DisplayName,Status,StartType |ConvertTo-Json'

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": getServices,
    "username": D.device.username(),
    "password": D.device.password()
};

// Check for Errors on the WinRM command response
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    D.device.sendWinRMCommand({ command: "Test-WSMan" }, function (output) {
        if (output.error === null) {
            D.success();
        } else {
            checkSshError(output.error);
        }
    });
}

/**
* @remote_procedure
* @label Get Host failed logon for the last hours
* @documentation This procedure retrieves last hour failed logon attempts
*/
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, callBackFunct);
}

var svcTable = D.createTable(
    "Monitored services",
    [

        { label: "Status" },
        { label: "StartType" }

    ]
);

function populateTable(svcName, displayname, status, startType) {
    const statusCodes = {
        "1": "Stopped",
        "2": "StartPending",
        "3": "StopPending",
        "4": "Running",
        "5": "ContinuePending",
        "6": "PausePending",
        "7": "Paused"
    };
    const startTypes = {
        "0": "Boot",
        "1": "System",
        "2": "Automatic",
        "3": "Manual",
        "4": "Disabled"
    };
    if (useDisplayName) {
        svcName = displayname;
    }
    status = statusCodes[status];
    startType = startTypes[startType]
    svcTable.insertRecord(svcName, [status, startType]);
}

function callBackFunct(output) {

    if (output.error === null) {
        var jsonOutput = JSON.parse(JSON.stringify(output));
        jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
        if (typeof jsonOutput.length === 'undefined') {
            populateTable(jsonOutput.ServiceName,
                jsonOutput.DisplayName,
                jsonOutput.Status.toString(),
                jsonOutput.StartType.toString()
            );
        } else {
            var k = 0;
            while (k < jsonOutput.length) {
                populateTable(jsonOutput[k].ServiceName,
                    jsonOutput[k].DisplayName,
                    jsonOutput[k].Status.toString(),
                    jsonOutput[k].StartType.toString()
                );
                k++;
            }
        }
        D.success(svcTable);
    } else {
        console.error(output.error);
        D.failure();
    }

}