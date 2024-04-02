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
var OSInfo = "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Manufacturer,Version,BuildNumber,OSArchitecture | ConvertTo-Json -Compress";
var biosInfo = "Get-CimInstance Win32_BIOS -erroraction 'silentlycontinue' | Select-Object SerialNumber | ConvertTo-Json -Compress";

// Define the WinRM options when running the commands
var winrmConfig = {
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

// Function to execute WinRM command
function executeWinrmCommand(command) {
    var d = D.q.defer();
    winrmConfig.command = command;
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        if (output.error === null) {
            d.resolve(output);
        } else {
            checkWinRmError(output.error);
        }            
    });
    return d.promise;
}

// Main function to execute WinRM commands for OS and BIOS information
function execute() {
    return D.q.all([
        executeWinrmCommand(OSInfo),
        executeWinrmCommand(biosInfo)
    ]);
}

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials and privileges provided
*/
function validate() { 
    execute()
        .then(parseValidateOutput)
        .then(checkWinRmError);
}


function parseValidateOutput(output) {
    for (var i = 0; i < output.length; i++) {
        if (output[i].error !== null) {
            console.error("Validation failed");
            return D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        }
    }
    console.log("Validation successful");
    return D.success();
}
/**
* @remote_procedure
* @label Get Windows OS Info
* @documentation This procedure is used to extract information regarding the Windows operating system, including details such as its name, version, build number, architecture, etc.
*/
function get_status() {
    execute()
        .then(parseOutput)
        .catch(checkWinRmError);
}

// Function to parse the output from WinRM commands and create variables
function parseOutput(output) {
    var variables = [];
    var biosInfoObject = false;
    
    output.forEach(function(result) {
        if (result.error === null && !biosInfoObject) {
            var OSInfo = JSON.parse(result.outcome.stdout);
            var name = OSInfo.Caption;
            var version = OSInfo.Version;
            var buildNumber = OSInfo.BuildNumber;
            var architecture = OSInfo.OSArchitecture;
            var vendor = OSInfo.Manufacturer;
            var osProductID = OSInfo.SerialNumber;
            
            if (name !== null && version !== null && buildNumber !== null && architecture !== null && vendor !== null && osProductID !== null) {
                
                variables.push(
                    D.createVariable("name", "Name", name, null, D.valueType.STRING ),
                    D.createVariable("version", "Version", version, null, D.valueType.STRING ),
                    D.createVariable("build-number", "Build Number", buildNumber, null, D.valueType.NUMBER ),
                    D.createVariable("architecture", "Architecture", architecture, null, D.valueType.STRING ),
                    D.createVariable("vendor", "Vendor", vendor, null, D.valueType.STRING ),
                    D.createVariable("product-id", "OS Product ID", osProductID, null, D.valueType.STRING )
                );
            }
            biosInfoObject = true;
        } else if (result.error === null && biosInfoObject) {
            var biosInfo = JSON.parse(result.outcome.stdout);
            if (biosInfo.SerialNumber !== null) {
                variables.push(D.createVariable("serial-number", "Serial Number", biosInfo.SerialNumber, null, D.valueType.STRING ));
            }
        } else {
            console.error(result.error);
        }
    });
    D.success(variables);
}
