/**
 * Domotz Custom Driver 
 * Name: Windows CPU usage
 * Description: This driver retrieves the average CPU load percentage of a Windows server.
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 *
 * Creates a Custom Driver Variable with CPU load percentage
 * 
 */

var winrmConfig = {
    "command": "Get-WmiObject Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select Average",
    "username": D.device.username(),
    "password": D.device.password()
};

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
* @label Validate WinRM connectivity with the device
* @documentation This procedure is used to validate the driver and credentials provided during association.
*/
function validate() {
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
* @label Get CPU usage percentage
* @documentation This procedure retrieves the average CPU load percentage of the device.
*/
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

/**
 * Parses the output of the WinRM command and extracts the CPU load percentage.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    if (output.error === null) {
        var outputLines = output.outcome.stdout.trim().split(/\r?\n/);
        var cpuValue = outputLines[2].replace(/\s+/g, ""); // To remove all spaces
        var cpu = [D.device.createVariable("loadPercentage", "Average", cpuValue, "%")];
        D.success(cpu);
    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}
