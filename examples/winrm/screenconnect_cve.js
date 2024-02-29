/**
 * Domotz Custom Driver 
 * Name: ScreenConnect CVE
 * Description: Detect ScreenConnect server vulnerabilities CVE-2024-1709 and CVE-2024-1708
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Windows 11
 * Powershell Version:
 *      - 5.1.21996.1
 * 
 * Creates a Custom Driver that detects if ScreenConnect server is installed on a Windows machine, its version and if it is affected by CVE-2024-1709 and CVE-2024-1708
 * 
 * Privilege required: Local Administrator
* 
**/


var getScreenConnectSoftware = 'Get-CimInstance -Class CIM_Product | Select-Object -Property Name,Version,Vendor,InstallDate | Where-Object { $_.Name -like "*ScreenConnect*" }  | ConvertTo-Json'

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": getScreenConnectSoftware,
    "username": D.device.username(),
    "password": D.device.password()
};


// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    if (err.message) 
        console.error(err.message);
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

function versionCompare(v1, v2) {
    var v1parts = v1.split('.'),
        v2parts = v2.split('.');

    function isValidPart(x) {
        return (/^\d+$/).test(x);
    }

    if (!v1parts.every(isValidPart) || !v2parts.every(isValidPart)) {
        return NaN;
    }

    v1parts = v1parts.map(Number);
    v2parts = v2parts.map(Number);

    for (var i = 0; i < v1parts.length; ++i) {
        if (v2parts.length == i) {
            return 1;
        }

        if (v1parts[i] == v2parts[i]) {
            continue;
        }
        else if (v1parts[i] > v2parts[i]) {
            return 1;
        }
        else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}
function parseOutput(output) {
    if (output.error === null) {
        console.info(JSON.stringify(output));
        var jsonOutput = JSON.parse(JSON.stringify(output));
        var applicationList = JSON.parse(jsonOutput.outcome.stdout);
        
        var installed = "Not installed";
        var version = "N/A";
        var vulnerable = "N/A";

        for (var k = 0; k < applicationList.length; k++) {
            if (applicationList[k].Name == "ScreenConnect") {
                installed = "Installed";
                version = applicationList[k].Version
                
                if (versionCompare(version, "23.9.7") <= 0)
                    vulnerable = "Vulnerable";
                else 
                    vulnerable = "Not vulnerable";

                break;
            }
        }

        var variables = [
            D.createVariable("screen-connect-installed", "ScreenConnect Server Installed", installed),
            D.createVariable("screen-connect-version", "ScreenConnect Server Version", version),
            D.createVariable("screen-connect-vulnerable", "ScreenConnect Server Vulnerability", vulnerable)
        ];
        D.success(variables);
    } else {
        console.error(output.error);
        D.failure();
    }
}