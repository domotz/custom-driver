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

/** Please note that not needed services can be excluded from the list.
 * 
 * If you want to use this please uncomment the two lines here under and modify
 * the excludeServices variable to contains the services you want to exclude 
 * inside single quote and separated by a comma for example 'AJRouter','BITS'
**/

//var excludeServices = "'AJRouter','BITS'"
//var command ="powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName} | Select-String -Pattern"+excludeServices+"-NotMatch\""

/** Below PS Command to be issued if you want to see all the Windows Services
 * If you are using the exclude services command above remember to comment out the below line.
**/
var command ="powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName}\""

// Define the SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 10000
};

var table = D.createTable(
    "Services List",
    [
        { label: "Service Name" },
        { label: "Status" },
        { label: "Description" }
    ]
);

// SSH promise definition
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function sshPromise(command){
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
    sshPromise(command).then(function(){
        D.success();
    });
}
 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/

function get_status() {
    sshPromise(command).then(function(result){
        
        var outputArr = result.split(/\r?\n/);
        var outputArrLen = outputArr.length;

        for (var i = 0; i < outputArrLen; i++) {
            var fields = outputArr[i].replace(/\s+/g,' ').trim();
            var uidN = i;
            var uid=uidN.toString();

            var fieldsArr = fields.split("#");
            console.log(fieldsArr);

            var serviceName=fieldsArr[0];
            var serviceStatus=fieldsArr[1];
            var serviceDescription=fieldsArr[2];

        table.insertRecord(
            uid, [serviceName, serviceStatus, serviceDescription]
        );
        }

        D.success(table);
        
    });
}
