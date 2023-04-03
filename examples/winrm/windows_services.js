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

// If you want to list ALL services just put '$null' as a filter 
// var svcFilter = '$null';

// For a server you may want to set the filter as follow :
var svcFilter = ["LanmanServer", "dnscache", "Windows Time", "dhcp", "schedule", "RpcEptMapper", "MpsSvc"]

if (svcFilter !== '$null'){
    svcFilter = '@("' + svcFilter.join('","') + '")';
}

var getServices = svcFilter + '|Get-Service|Select-Object ServiceName,DisplayName,Status,StartType | ConvertTo-Json'

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": getServices,
    "username": D.device.username(),
    "password": D.device.password()
};


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

var svcTable = D.createTable(
    "Monitored services",
    [

        { label: "Service Name" },
        { label: "Status" },
        { label: "Start Type" }

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
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials and privileges provided
*/
function validate() { 
    winrmConfig.command =  "Get-Service eventlog"
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
* @label Get the selected services data
* @documentation This procedure retrieves data for the selected services
*/
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

function populateTable(svcName, displayname, status, startType) {
    var recordID;
    recordID = displayname.slice(0, 50);
    status = statusCodes[status];
    startType = startTypes[startType]
    svcTable.insertRecord(recordID, [svcName, status, startType]);
}

function parseOutput(output) {
    if (output.error === null) {
        var jsonOutput = JSON.parse(JSON.stringify(output));
        jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
        if (jsonOutput) {
            var k = 0;
            while (k < jsonOutput.length) {
                populateTable(jsonOutput[k].ServiceName,
                    jsonOutput[k].DisplayName,
                    jsonOutput[k].Status.toString(),
                    jsonOutput[k].StartType.toString()
                );
                k++;
            }
        } else {
            populateTable(jsonOutput.ServiceName,
                jsonOutput.DisplayName,
                jsonOutput.Status.toString(),
                jsonOutput.StartType.toString()
            );
        }
        D.success(svcTable);
    } else {
        console.error(output.error);
        D.failure();
    }

}