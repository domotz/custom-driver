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
// For Windows 10 computer (workstation) you may want to set the filter the following way:
// var svcFilter = ["dhcp", "dnscache", "LanmanServer", "MpsSvc", "RpcEptMapper", "schedule", "Windows Time"]
// For a server you may want to set the filter the following way:
var svcFilter = D.getParameter('servicesFilter');

if (svcFilter !== '$null'){
    var svcFilterString = svcFilter.join('","').replace(/\$/g, '`$');
    getServices = 'ConvertTo-Json @(@("' + svcFilterString + '") | Get-Service | Select-Object ServiceName,DisplayName,Status,StartType)';
}

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": getServices,
    "username": D.device.username(),
    "password": D.device.password()
};

var statusCodes = {
    "1": "Stopped",
    "2": "StartPending",
    "3": "StopPending",
    "4": "Running",
    "5": "ContinuePending",
    "6": "PausePending",
    "7": "Paused"
};
var startTypes = {
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
    if (err.code == 401){
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code == 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials and privileges provided
*/
function validate() { 
    winrmConfig.command = "Get-Service eventlog";
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
    var recordID = displayname.slice(0, 50);
    status = statusCodes[status];
    startType = startTypes[startType];
    svcTable.insertRecord(recordID, [svcName, status, startType]);
}

function parseOutput(output) {
    if (output.error === null) {
        var jsonOutput = JSON.parse(JSON.stringify(output));
        var listOfServices = JSON.parse(jsonOutput.outcome.stdout);
        for (var k = 0; k < listOfServices.length; k++) {
            populateTable(
                listOfServices[k].ServiceName,
                listOfServices[k].DisplayName,
                listOfServices[k].Status.toString(),
                listOfServices[k].StartType.toString()
            );
        }
        var stderr = jsonOutput.outcome.stderr;
        if (stderr !== null) {
            var errorList = stderr.split('Get-Service :');
            for (var j = 0; j < errorList.length; j++) {
                if (errorList[j] !== '') {
                    console.error(errorList[j]);
                }
            }
        }
        D.success(svcTable);
    } else {
        checkWinRmError(output.error);
    }
}