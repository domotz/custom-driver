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

/** Define the services you want to exclude or include. If empty all services are retrieved
 * Examples:
 * 1 - Monitor ALL SERVICES:
 * var exludedServices = [];
 * var monitoredServices = [];
 * 
 * 2 - Exclude services AJROUTER, all the services which the string Win
 * var exludedServices = ['AJRouter','Win];;
 * var monitoredServices = [];
 * 
 * 2 - Monitor only (include only) services called AJROUTER, and all the services which contain B
 * var exludedServices = [];;
 * var monitoredServices = ['AJRouter','Win'];
 * 
*/

var exludedServices = ['AJRouter','B'];;
var monitoredServices = [];

// SSH options when running the commands
var sshConfig = {
    command: getCommandForMonitoredServices(),
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000
};

// Check for SSH Errors in the communication with the windows device the driver is applied on
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR)
    } else if (err.code == 255){
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    };
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    D.device.sendSSHCommand(sshConfig, function(output, error){
        if (error) {
            checkSshError(error)
        } else if (!output || output.indexOf("is not recognized") !== -1) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else {
            D.success();
        }
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    D.device.sendSSHCommand(sshConfig, parseResultCallback);
}

function getCommandForMonitoredServices(){
    console.info(exludedServices.length)
    if (exludedServices.length > 0 && monitoredServices.length > 0) {
        console.error("exludedServices and monitoredServices variables cannot be both not empty");
        D.failure(D.errorType.GENERIC_ERROR);
    } else {
        if (exludedServices.length > 0){
            return "powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName} | Select-String -Pattern " + exludedServices.toString() + " -NotMatch\""
        } else {
            if (monitoredServices.length > 0){
                return "powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName} | Select-String -Pattern " + monitoredServices.toString()
            } else {
            return "powershell -command \"Get-Service | Select Status,Name,DisplayName | foreach { $_.Name + '#' + $_.Status + '#' +  $_.DisplayName}\""
            }
        }
    }
}

// Result parsing callback for variables data
function parseResultCallback(output, error){
    if (error) {
        checkSshError(error)
    } else {
        var result = output.split(/\r?\n/);
        var table = D.createTable(
            "Services List",
            [
                { label: "Service Name" },
                { label: "Status" },
                { label: "Description" }
            ]
        );     
        for (var i = 0; i < result.length; i++) {
            var fields = result[i].replace(/\s+/g,' ').trim().split("#");
            var serviceName=fields[0];
            var serviceStatus=fields[1];
            var serviceDescription=fields[2];
            table.insertRecord(
                serviceName.toLowerCase().substring(0, 50), [serviceName, serviceStatus, serviceDescription]
            );
        }
        D.success(table);
    };
}