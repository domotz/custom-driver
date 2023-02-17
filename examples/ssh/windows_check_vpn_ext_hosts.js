/**
 * Domotz Custom Driver 
 * Name: Windows check VPN connection
 * Description: Check if a list of hosts are reachable from the endpoint where the script is run 
 *   
 * Communication protocol is SSH. Utilizing the native windows powershell command.
 * 
 * Tested on Windows Versions:
 *  - Windows 10
 *  - Microsoft Windows Server 2019
 * 
 * Powershell Version:
 *  - 5.1.19041.2364
 * 
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Host
 *  - Reachable
 * 
 *  Reachable can be [Yes, No]
 * 
**/

// Define here the list of hosts/ips you would like to check
var hostsToCheck = "www.notworkingnetaddress.com,www.google.com,www.microsoft.com.it,129.312.32.31" 

// SSh command run on the endpoint
var command="powershell -command \"Test-Connection -Cn "+hostsToCheck+" -BufferSize 16 -Count 1 -ea 0 -quiet \""

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
* @label Get Hosts/IPs data 
* @documentation This procedure is used for retrieving device * variables data
*/

function get_status() {
    executeCommand(command).then(function(result){
        var hostsToCheckArr = hostsToCheck.split(",");
        var outputArr = result.split(/\r?\n/);
        var outputArrLen = outputArr.length;

        // Crate table that shows parsed variables
        var table = D.createTable(
                    "Hosts/IPs to validate",
                    [
                        { label: "Host" },
                        { label: "Reachable"}
                    ]
                );

        // Parse response and populate the table        
        for (var i = 0; i < outputArrLen; i++) {
            var uid="id-"+i.toString()+"-reachable";
            if (outputArr[i] !== "") {
            var host = hostsToCheckArr[i]
                if (outputArr[i] != "True"){
                    var reachable="No"
                }
                else {
                    var reachable="Yes"
                }
            
            } 
        table.insertRecord(
                uid, [host, reachable]
            );
        }

        D.success(table);
        
    });
}
