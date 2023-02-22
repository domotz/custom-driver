/**
 * Domotz Custom Driver 
 * Name: Windows Services Monitoring
 * Description: Monitors the status of all the services on a Windows machine
 *   
 * Communication protocol is SSH, using the native windows powershell command.
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Service Name
 *  - Service Status
 *  - Service Description
 * 
**/

// Define the services you want to show (all|exclude)
// if using the "exclude" option you might edit the excludeServices variable which contains the list
var servicesToGet="all"; 

if (servicesToGet == "exclude") {
  var excludeServices = "'AJRouter','BITS'";
  var command ="powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName} | Select-String -Pattern "+excludeServices+" -NotMatch\"";
}
else if (servicesToGet == "all") {
  var command ="powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName}\"";
}
else if (!servicesToGet || /^\s*$/.test(servicesToGet)){
  var error="servicesToGet variable cannot be null or empty - possible options are: all|exclude" ;
  console.error(error);
  D.failure(D.errorType.GENERIC_ERROR);
}
else{
  var error="servicesToGet variable cannot be set as: "+ servicesToGet + " - possible options are: all|exclude";
  console.error(error);
  D.failure(D.errorType.GENERIC_ERROR);
}

// SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 10000
};

// SSH promise definition
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command){
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if(err) checkSshError(err);
        d.resolve(out);
    });
    return d.promise;
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(command).then(function(){
        D.success();
    });
}
 
/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    executeCommand(command).then(function(result){
        var table = D.createTable(
            "Services List",
            [
                { label: "Service Name" },
                { label: "Status" },
                { label: "Description" }
            ]
        );        
        var result = result.split(/\r?\n/);
        for (var i = 0; i < result.length; i++) {
            var fields = result[i].replace(/\s+/g,' ').trim().split("#");
            var serviceName=fields[0];
            var serviceStatus=fields[1];
            var serviceDescription=fields[2];
            table.insertRecord(
                i+"-"+serviceName.toLowerCase(), [serviceName, serviceStatus, serviceDescription]
            );
        }
        D.success(table);
    });
}
