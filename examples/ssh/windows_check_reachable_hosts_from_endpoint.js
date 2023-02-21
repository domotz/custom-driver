/**
 * Domotz Custom Driver 
 * Name: Windows - check reachable hosts from endpoint
 * Description: Checks if a list of hosts are reachable from the endpoint where the script is run this can be used 
 * for various case scenarios, including checking if a VPN connection is up or not (indirectly by checking if you 
 * can reach some hosts which are reachable only by VPN)
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
var hostsToCheck = ["www.notworkingnetaddress.com", "www.google.com", "www.microsoft.com.it", "129.312.32.31"]

// SSH options when running the commands
var sshConfig = {
    // SSh command run on the endpoint
    command: "powershell -command \"Test-Connection -Cn " + hostsToCheck.toString() + " -BufferSize 16 -Count 1 -ea 0 -quiet \"",
    username: D.device.username(),
    password: D.device.password(),
    timeout: 10000
};

// SSH promise definition
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function(out, err) {
        if (err) checkSshError(err);
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
    executeCommand(sshConfig.command).then(function() {
        D.success();
    });
}


/**
 * @remote_procedure
 * @label Get if Hosts/IPs are reachable or not and display them in a table 
 * @documentation This procedure is used for crating the table from the data we are getting from the powershell command issued on the Windows Computer
 */

function get_status() {
    executeCommand(sshConfig.command).then(function(result) {
        var result = result.split(/\r?\n/);

        // Crate table that shows parsed variables
        var table = D.createTable(
            "Hosts/IPs to validate",
            [{
                    label: "Host"
                },
                {
                    label: "Reachable"
                }
            ]
        );

        // Parse response and populate the table        
        for (var i = 0; i < result.length; i++) {
            var uid = "id-" + i + "-reachable";
            if (result[i] !== "") {
                var host = hostsToCheck[i]
                if (result[i] != "True") {
                    var reachable = "No"
                } else {
                    var reachable = "Yes"
                }

            }
            table.insertRecord(
                uid, [host, reachable]
            );
        }
        D.success(table);
    });
}