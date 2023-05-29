/**
 * Domotz Custom Driver 
 * Name: Windows CPU usage
 * Description: This driver retrieves the average CPU load average percentage of a Windows server.
 *   
 * Communication protocol is SSH
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 *
 * Creates a Custom Driver Variable with CPU load average percentage
 * 
 */

var sshConfig = {
    "command": 'powershell -command \"Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select Average\"',
    "username": D.device.username(),
    "password": D.device.password()
};

// Check for Errors on the SSH command response
function checkSshError(err) {
    console.info(err);
    if (err.message) console.error(err.message);
    if (err.code == 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code == 255){
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
* @remote_procedure
* @label Validate SSH connectivity with the device
* @documentation This procedure is used to validate the driver and credentials provided during association.
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    D.device.sendSSHCommand(sshConfig, function(output, error){
        if (error) {
            checkSshError(error);
        } else if (!output || output.indexOf("is not recognized") !== -1) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } else {
            D.success();
        }
    });
}


/**
* @remote_procedure
* @label Get CPU usage percentage
* @documentation This procedure retrieves the average CPU load percentage of the device.
*/
function get_status() {
    D.device.sendSSHCommand(sshConfig, parseOutput);
}


/**
 * Parses the output of the SSH command and extracts the CPU load percentage.
 * @param {object} output - The output of the SSH command.
 */
function parseOutput(output, error) {
    if (error) {
        checkSshError(error);
    } else{
        var outputLines = output.split(/\r?\n/);
        var cpuValue = outputLines[2].replace(/\s+/g, ""); // To remove all spaces
        var cpuLoadAverage = D.device.createVariable("cpu-load-average", "CPU Load Average", cpuValue, "%", D.valueType.NUMBER);
        D.success([cpuLoadAverage]);
    }
}
