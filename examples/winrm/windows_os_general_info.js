/**
 * Domotz Custom Driver
 * Name: Windows OS General Monitoring
 * Description: Monitors the general information for Windows Operating System
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 *
 * Tested on Windows Version
 *  - Windows 11
 *
 * PowerShell Version:
 *  - 5.1.21996.1
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
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
const osInfo = "Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Manufacturer,Version,BuildNumber,OSArchitecture, SerialNumber";
const biosInfo = "Get-CimInstance Win32_BIOS -erroraction 'silentlycontinue' | Select-Object SerialNumber";
const command = '@{ OperatingSystem = ' + osInfo + '; BIOS = ' + biosInfo + '} | ConvertTo-Json -Compress';


// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// Define the options when running the commands
const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

function parseValidateOutput(isValidated) {
    if (isValidated) {
        console.info("Validation successful");
        D.success();
    } else {
        console.error("Validation unsuccessful");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * @remote_procedure
 * @label Validate connectivity with the device
 * @documentation This procedure is used to validate the driver and credentials provided during association.
 */
function validate() {
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Windows OS Info
 * @documentation This procedure is used to extract information regarding the Windows operating system, including details such as its name, version, build number, architecture, etc.
 */
function get_status() {
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

// Function to parse the output from commands and create variables
function parseOutput(generalInfo) {
    const variables = [];
    const name = generalInfo.OperatingSystem.Caption ? generalInfo.OperatingSystem.Caption : "N/A";
    const version = generalInfo.OperatingSystem.Version ? generalInfo.OperatingSystem.Version : "N/A";
    const buildNumber = generalInfo.OperatingSystem.BuildNumber;
    const architecture = generalInfo.OperatingSystem.OSArchitecture ? generalInfo.OperatingSystem.OSArchitecture : "N/A";
    const vendor = generalInfo.OperatingSystem.Manufacturer ? generalInfo.OperatingSystem.Manufacturer : "N/A";
    const osProductID = generalInfo.OperatingSystem.SerialNumber ? generalInfo.OperatingSystem.SerialNumber : "N/A";
    const serialNumber = generalInfo.BIOS.SerialNumber ? generalInfo.BIOS.SerialNumber : "N/A";

    variables.push(
        D.createVariable("name", "Name", name, null, D.valueType.STRING),
        D.createVariable("version", "Version", version, null, D.valueType.STRING),
        D.createVariable("build-number", "Build Number", buildNumber, null, D.valueType.NUMBER),
        D.createVariable("architecture", "Architecture", architecture, null, D.valueType.STRING),
        D.createVariable("vendor", "Vendor", vendor, null, D.valueType.STRING),
        D.createVariable("product-id", "OS Product ID", osProductID, null, D.valueType.STRING),
        D.createVariable("serial-number", "Serial Number", serialNumber, null, D.valueType.STRING)
    );

    D.success(variables);
}

// WinRM functions
function WinRMHandler() {
}

// Check for Errors on the command response
WinRMHandler.prototype.checkError = function (output) {
    if (output.message) console.error(output.message);
    if (output.code === 401) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (output.code === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(output);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute command
WinRMHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    config.command = command;
    D.device.sendWinRMCommand(config, function (output) {
        if (output.error) {
            self.checkError(output);
            d.reject(output.error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

WinRMHandler.prototype.parseOutputToJson = function (output) {
    const jsonString = output.outcome.stdout
    return jsonString ? JSON.parse(jsonString) : null;
}

WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout
}

// SSH functions
function SSHHandler() {
}

// Check for Errors on the command response
SSHHandler.prototype.checkError = function (output, error) {
    if (error) {
        if (error.message) console.error(error.message);
        if (error.code === 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
        if (error.code === 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        console.error(error);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

SSHHandler.prototype.executeCommand = function (command) {
    const d = D.q.defer();
    const self = this;
    config.command = 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
    D.device.sendSSHCommand(config, function (output, error) {
        if (error) {
            self.checkError(output, error);
            d.reject(error);
        } else {
            d.resolve(output);
        }
    });
    return d.promise;
}

SSHHandler.prototype.parseOutputToJson = function (output) {
    return JSON.parse(output);
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}