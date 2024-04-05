/**
 * Domotz Custom Driver 
 * Name: Windows CPU and Memory
 * Description: Monitors CPU and memory usage of a Windows machine
 * 
 * Communication protocol is WinRM
 * 
 * Tested on Windows Version
 *  - Windows 11
 * 
 * Powershell Version:
 *  - 5.1.21996.1
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
 *      - CPU Load Average (10 sec): Average CPU load over 10 seconds
 * 
 * Privilege required: Administrator
 * 
 */


// Variable to store PowerShell command for retrieving total memory
var totalMemory = '(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).Sum'; 

// Variable to store PowerShell command for retrieving available memory
var availableMemory = '(Get-Counter "\\Memory\\Available MBytes").CounterSamples.CookedValue';

// Variable to store PowerShell command for retrieving CPU information
var cpuInfo = 'Get-CimInstance Win32_processor | Select-Object name, MaxClockSpeed, NumberOfLogicalProcessors, NumberOfCores, Status';

// Variable to store PowerShell command for retrieving CPU usage
var cpuUsage = '(Get-Counter -Counter "\\Processor(_Total)\\% Processor Time" -SampleInterval 2 -MaxSamples 5 | Select-Object -ExpandProperty countersamples | Select-Object -ExpandProperty cookedvalue | Measure-Object -Average).Average';

// WinRM configuration 
var winrmConfig = {
    "command": '@{ TotalMemory = ' + totalMemory + '; AvailableMemory = ' + availableMemory + '; CPUInfo = ' + cpuInfo + '; Average = ' + cpuUsage + '} | ConvertTo-Json -Compress',
    "username": D.device.username(),
    "password": D.device.password(),
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
* @label Get CPU and memory usage 
* @documentation This procedure retrieves CPU and memory usage information
*/
function get_status() {
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

// Parse the output from WinRM commands and create variables
function parseOutput(output) {
    if (output.error === null) {
        var cpuMemoryInfo = JSON.parse(output.outcome.stdout);
        console.log(cpuMemoryInfo);
        var totalMemory = cpuMemoryInfo.TotalMemory / (Math.pow(1024, 3));
        var availableMemory = cpuMemoryInfo.AvailableMemory / 1024;
        var memoryUsage = ((totalMemory - availableMemory) / totalMemory) * 100;
        var cpuName = cpuMemoryInfo.CPUInfo.name;
        var maxClockSpeed = cpuMemoryInfo.CPUInfo.MaxClockSpeed / 1000;
        var logicalProcessorsNumber = cpuMemoryInfo.CPUInfo.NumberOfLogicalProcessors;
        var coresNumber = cpuMemoryInfo.CPUInfo.NumberOfCores;
        var cpuStatus = cpuMemoryInfo.CPUInfo.Status;
        var cpuAverage = cpuMemoryInfo.Average;
        var variables = [
            D.device.createVariable("total-memory", "Total Memory", totalMemory, "GB", D.valueType.NUMBER),
            D.device.createVariable("available-memory", "Available Memory", availableMemory.toFixed(2), "GB", D.valueType.NUMBER),
            D.device.createVariable("memory-usage", "Memory Usage", memoryUsage.toFixed(2), "%", D.valueType.NUMBER),
            D.device.createVariable("cpu-name", "CPU Name", cpuName, null, D.valueType.STRING),
            D.device.createVariable("max-clock-speed", "Max Clock Speed", maxClockSpeed, "GHz", D.valueType.NUMBER),
            D.device.createVariable("logical-processors-number", "Logical Processors Number", logicalProcessorsNumber, null, D.valueType.NUMBER),
            D.device.createVariable("cores-number", "Cores Number", coresNumber, null, D.valueType.NUMBER),
            D.device.createVariable("cpu-status", "CPU Status", cpuStatus, null, D.valueType.STRING),
            D.device.createVariable("cpu-average", "CPU Load Average (10 sec)", cpuAverage.toFixed(2), "%", D.valueType.NUMBER)
        ];
        D.success(variables);
    } else {
        console.error(output.error);
        checkWinRmError(output.error);
    }
}
