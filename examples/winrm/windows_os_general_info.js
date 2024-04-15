/**
 * Domotz Custom Driver 
 * Name: Windows OS General Monitoring
 * Description: Monitors the general information for Windows Operating System
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Version
 *  - Windows 11
 * 
 * Powershell Version:
 *  - 5.1.21996.1
 * 
 * Creates a Custom Driver Variable:
 *    - Name: The name of the operating system
 *    - Version: The version of the operating system
 *    - Build Number: The build number of the operating system
 *    - Architecture: The architecture of the operating system
 *    - Serial Number: The serial number of the BIOS
 *    - Vendor: The manufacturer of the operating system
 *    - OS Product ID: The product ID of the operating system
 * 
 * Privilege required: AD User
 * 
 **/

// PowerShell commands to retrieve OS and BIOS information
var osInfo = "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Manufacturer,Version,BuildNumber,OSArchitecture, SerialNumber";
var biosInfo = "Get-CimInstance Win32_BIOS -erroraction 'silentlycontinue' | Select-Object SerialNumber";

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": '@{ OperatingSystem = ' + osInfo + '; BIOS = ' + biosInfo + '} | ConvertTo-Json -Compress',
    "username": D.device.username(),
    "password": D.device.password()
};

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
* @label Get Windows OS Info
* @documentation This procedure is used to extract information regarding the Windows operating system, including details such as its name, version, build number, architecture, etc.
*/
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

// Function to parse the output from WinRM commands and create variables
function parseOutput(output) {
    var variables = [];
    if (output.error === null) {
        var generalInfo = JSON.parse(output.outcome.stdout);
        var name = generalInfo.OperatingSystem.Caption ? generalInfo.OperatingSystem.Caption : "N/A";
        var version = generalInfo.OperatingSystem.Version ? generalInfo.OperatingSystem.Version : "N/A";
        var buildNumber = generalInfo.OperatingSystem.BuildNumber;
        var architecture = generalInfo.OperatingSystem.OSArchitecture ? generalInfo.OperatingSystem.OSArchitecture : "N/A";
        var vendor = generalInfo.OperatingSystem.Manufacturer ? generalInfo.OperatingSystem.Manufacturer : "N/A";
        var osProductID = generalInfo.OperatingSystem.SerialNumber ? generalInfo.OperatingSystem.SerialNumber : "N/A";     
        var serialNumber = generalInfo.BIOS.SerialNumber ? generalInfo.BIOS.SerialNumber : "N/A";
        
        variables.push(
            D.createVariable("name", "Name", name, null, D.valueType.STRING ),
            D.createVariable("version", "Version", version, null, D.valueType.STRING ),
            D.createVariable("build-number", "Build Number", buildNumber, null, D.valueType.NUMBER ),
            D.createVariable("architecture", "Architecture", architecture, null, D.valueType.STRING ),
            D.createVariable("vendor", "Vendor", vendor, null, D.valueType.STRING ),
            D.createVariable("product-id", "OS Product ID", osProductID, null, D.valueType.STRING ),
            D.createVariable("serial-number", "Serial Number", serialNumber, null, D.valueType.STRING )
        );

        D.success(variables);

    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}