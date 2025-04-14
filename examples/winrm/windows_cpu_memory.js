/**
 * Domotz Custom Driver
 * Name: Windows CPU and Memory
 * Description: Monitors CPU and memory usage of a Windows machine.
 * Please note that to retrieve CPU load metric it is necessary to add the WinRM user to the security group "Performance Monitor Users"
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Tested on Windows Version
 *  - Windows 11
 *
 * PowerShell Version:
 *  - 5.1.21996.1
 *
 *  Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates Custom Driver variables:
 *      - Total Memory: Total physical memory of the system
 *      - Available Memory: Amount of memory available for processes
 *      - Memory Usage: Percentage of memory usage
 *      - CPU Name: Name of the CPU
 *      - Max Clock Speed: Maximum clock speed of the CPU
 *      - Logical Processors Number: Number of logical processors
 *      - Cores Number: Number of CPU cores
 *      - CPU Status: Status of the CPU
 *      - CPU Load Average (10 sec): Average CPU load over 10 seconds (please note that to retrieve this metric it is necessary to add the WinRM user to the security group "Performance Monitor Users")
 */

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// Variable to store PowerShell command for retrieving total memory
const totalMemory = '(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).Sum';

// Variable to store PowerShell command for retrieving available memory
const availableMemory = 'Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory';

// Variable to store PowerShell command for retrieving CPU information
const cpuInfo = 'Get-CimInstance Win32_processor | Select-Object name, MaxClockSpeed, NumberOfLogicalProcessors, NumberOfCores, Status';

// Variable to store PowerShell command for retrieving CPU usage
const cpuUsage = '(Get-Counter -Counter "\\Processor(_Total)\\% Processor Time" -SampleInterval 2 -MaxSamples 5 | Select-Object -ExpandProperty countersamples | Select-Object -ExpandProperty cookedvalue | Measure-Object -Average).Average';

const command = '@{ TotalMemory = ' + totalMemory + '; AvailableMemory = ' + availableMemory + '; CPUInfo = ' + cpuInfo + '; Average = ' + cpuUsage + '} | ConvertTo-Json -Compress';

// WinRM configuration 
const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000,
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
 * @label Validate WinRM connectivity with the device
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
 * @label Get CPU and memory usage
 * @documentation This procedure retrieves CPU and memory usage information
 */
function get_status() {
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

// Parse the output from WinRM commands and create variables
function parseOutput(cpuMemoryInfo) {
    const totalMemory = cpuMemoryInfo.TotalMemory / (Math.pow(1024, 3));
    const availableMemory = cpuMemoryInfo.AvailableMemory / 1024 / 1024;
    const memoryUsage = ((totalMemory - availableMemory) / totalMemory) * 100;
    const cpuName = cpuMemoryInfo.CPUInfo.name;
    const maxClockSpeed = cpuMemoryInfo.CPUInfo.MaxClockSpeed / 1000;
    const logicalProcessorsNumber = cpuMemoryInfo.CPUInfo.NumberOfLogicalProcessors;
    const coresNumber = cpuMemoryInfo.CPUInfo.NumberOfCores;
    const cpuStatus = cpuMemoryInfo.CPUInfo.Status;
    const cpuAverage = cpuMemoryInfo.Average ? cpuMemoryInfo.Average.toFixed(2) : "N/A"

    const variables = [
        D.device.createVariable("total-memory", "Total Memory", totalMemory, "GiB", D.valueType.NUMBER),
        D.device.createVariable("available-memory", "Available Memory", availableMemory.toFixed(2), "GiB", D.valueType.NUMBER),
        D.device.createVariable("memory-usage", "Memory Usage", memoryUsage.toFixed(2), "%", D.valueType.NUMBER),
        D.device.createVariable("cpu-name", "CPU Name", cpuName, null, D.valueType.STRING),
        D.device.createVariable("max-clock-speed", "Max Clock Speed", maxClockSpeed, "GHz", D.valueType.NUMBER),
        D.device.createVariable("logical-processors-number", "Logical Processors Number", logicalProcessorsNumber, null, D.valueType.NUMBER),
        D.device.createVariable("cores-number", "Cores Number", coresNumber, null, D.valueType.NUMBER),
        D.device.createVariable("cpu-status", "CPU Status", cpuStatus, null, D.valueType.STRING),
        D.device.createVariable("cpu-average", "CPU Load Average (10 sec)", cpuAverage, "%", D.valueType.NUMBER)
    ];
    D.success(variables);
}


// WinRM functions
function WinRMHandler() {}

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
    return JSON.parse(output.outcome.stdout);
}

WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout
}

// SSH functions
function SSHHandler() {}

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