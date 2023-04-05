/**
 * Domotz Custom Driver 
 * Name: Windows GPOs version
 * Description: monitors the versions of selected GPOs, you can set the initial value as baseeline and get alerted if it changes. 
 * It must run agains a DC with PS GroupPolicy module installed
 *    
 *  
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver Table with Policy name, status, User AD and SYSVOL versions, Computer AD and SYSVOL version
 * 
 * Required permissions: AD user
 * 
**/


// Define the WinRM options when running the commands
var winrmConfig = {
    "command": '',
    "username": D.device.username(),
    "password": D.device.password()

};



/**
 * GPO to monitor
 * @var Array auditedEvents
 **/
var gpArray = ["Default Domain Policy", "Default Domain Controllers Policy"];
gpArray = "'" + gpArray.join("','") + "'"



var gpoTable = D.createTable(
    "Security events ",
    [

        { label: "Status" },
        { label: "AD Version (User)" },
        { label: "SYSVOL Version (User)" },
        { label: "AD Version (Computer)" },
        { label: "SYSVOL Version (Computer)" }


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
    //winrmConfig.command = 'auditpol /get /category:*'
    winrmConfig.command = 'Get-GPO -Name "Default Domain Policy"'
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        console.log(JSON.stringify(output));
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
    winrmConfig.command = '$GPOs =@(' + gpArray + ');$GPOVersions = [System.Collections.ArrayList]::new();foreach ($p in $GPOs) {$GPData = Get-GPO -Name $p;$GPOVersions += [PSCustomObject]@{Name = $GPData.Displayname;Status= $($GPData.GpoStatus).ToString();UADVersion= $GPData.User.DSVersion;USVVersion= $GPData.User.SysvolVersion;CADVersion= $GPData.Computer.DSVersion;CSVVersion= $GPData.Computer.SysvolVersion;}};$GPOVersions | ConvertTo-Json';
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

function parseOutput(output) {
    if (output.error === null) {
        var k = 0;
        var jsonOutput = JSON.parse(JSON.stringify(output));
        jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
        var eventsInOutput = [];
        while (k < jsonOutput.length) {
            var eventId = jsonOutput[k].Name;
            gpoTable.insertRecord((jsonOutput[k].Name).slice(0,50), [
                jsonOutput[k].Status,
                jsonOutput[k].UADVersion,
                jsonOutput[k].USVVersion,
                jsonOutput[k].CADVersion,
                jsonOutput[k].CSVVersion
            ]);
            k++
        }

        D.success(gpoTable);
    } else {
        console.error(output.error);
        D.failure();
    }

}