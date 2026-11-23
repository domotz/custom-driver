/**
 * Domotz Custom Driver
 * Name: Windows CPU and Memory (HTTPS)
 * Description: Monitors CPU and memory usage of a Windows machine.
 * Uses WinRM over HTTPS (port 5986). Requires the WinRM listener configured for HTTPS on the target.
 *
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
 *      - CPU Name: Name of the CPU (each distinct model, comma separated, on a multi-socket machine)
 *      - Max Clock Speed: Maximum clock speed of the CPU (the highest across sockets)
 *      - Logical Processors Number: Number of logical processors (sum of all sockets)
 *      - Cores Number: Number of CPU cores (sum of all sockets)
 *      - CPU Status: Status of the CPU (each distinct status, comma separated, on a multi-socket machine)
 *      - CPU Load Average (10 sec): Average CPU load over 10 seconds (please note that to retrieve this metric it is necessary to add the WinRM user to the security group "Performance Monitor Users")
 */

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter("protocol");

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// Variable to store PowerShell command for retrieving total memory
const totalMemory = "(Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property capacity -Sum).Sum";

// Variable to store PowerShell command for retrieving available memory
const availableMemory = "Get-CimInstance Win32_OperatingSystem | Select-Object -ExpandProperty FreePhysicalMemory";

// Variable to store PowerShell command for retrieving CPU information
const cpuInfo = "Get-CimInstance Win32_processor | Select-Object name, MaxClockSpeed, NumberOfLogicalProcessors, NumberOfCores, Status";

// Variable to store PowerShell command for retrieving CPU usage
const cpuUsage = '(Get-Counter -Counter "\\Processor(_Total)\\% Processor Time" -SampleInterval 2 -MaxSamples 5 | Select-Object -ExpandProperty countersamples | Select-Object -ExpandProperty cookedvalue | Measure-Object -Average).Average';

const command = "@{ TotalMemory = " + totalMemory + "; AvailableMemory = " + availableMemory + "; CPUInfo = " + cpuInfo + "; Average = " + cpuUsage + "} | ConvertTo-Json -Compress";

// WinRM configuration
const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    // WinRM transport options for HTTPS (port 5986). Adjust as needed:
    port: 5986,                // 5986 = HTTPS (5985 for HTTP)
    scheme: "https",           // "http" | "https"
    skipVerify: true,          // set to false to enforce TLS certificate verification
    // auth: "auto",           // "basic" | "ntlm" | "auto" (inferred from username)
    timeout: 30000            // per-command timeout in milliseconds
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

// Win32_processor returns one object per physical socket, so ConvertTo-Json gives a bare object on a
// single-socket machine and an array on a multi-socket one. The variables describe the whole machine:
// cores and logical processors are summed, the clock speed is the highest, names and statuses list each distinct value.
// A value no socket reports stays null instead of becoming a 0 that looks measured.
// Returns null when the reply carries no processor data at all.
function summarizeProcessors(cpuInfo) {
    // Some PowerShell serializations wrap an array as { value: [...], Count: n }
    const list = cpuInfo && Array.isArray(cpuInfo.value) ? cpuInfo.value : cpuInfo;
    const processors = [].concat(list || []).filter(function (processor) {
        return processor && typeof processor === "object";
    });
    const names = [];
    const statuses = [];
    const summary = { maxClockSpeed: null, logicalProcessors: null, cores: null };
    function number(value) {
        return value == null || value === "" || !isFinite(Number(value)) ? null : Number(value);
    }
    function add(total, value) {
        return number(value) === null ? total : (total || 0) + number(value);
    }
    processors.forEach(function (processor) {
        if (processor.name != null && names.indexOf(processor.name) === -1) names.push(processor.name);
        if (processor.Status != null && statuses.indexOf(processor.Status) === -1) statuses.push(processor.Status);
        const clockSpeed = number(processor.MaxClockSpeed);
        if (clockSpeed !== null) summary.maxClockSpeed = Math.max(summary.maxClockSpeed || 0, clockSpeed);
        summary.logicalProcessors = add(summary.logicalProcessors, processor.NumberOfLogicalProcessors);
        summary.cores = add(summary.cores, processor.NumberOfCores);
    });
    summary.name = names.length ? names.join(", ") : null;
    summary.status = statuses.length ? statuses.join(", ") : null;
    const hasData = Object.keys(summary).some(function (key) { return summary[key] !== null; });
    return hasData ? summary : null;
}

// Parse the output from WinRM commands and create variables
function parseOutput(cpuMemoryInfo) {
    const totalMemory = cpuMemoryInfo.TotalMemory / (Math.pow(1024, 3));
    const availableMemory = cpuMemoryInfo.AvailableMemory / 1024 / 1024;
    const memoryUsage = ((totalMemory - availableMemory) / totalMemory) * 100;
    const cpu = summarizeProcessors(cpuMemoryInfo.CPUInfo);
    if (!cpu) {
        console.error("The device returned no processor information");
        D.failure(D.errorType.GENERIC_ERROR);
        return;
    }
    const cpuName = cpu.name;
    const maxClockSpeed = cpu.maxClockSpeed === null ? null : cpu.maxClockSpeed / 1000;
    const logicalProcessorsNumber = cpu.logicalProcessors;
    const coresNumber = cpu.cores;
    const cpuStatus = cpu.status;
    const cpuAverage = cpuMemoryInfo.Average ? cpuMemoryInfo.Average.toFixed(2) : "N/A";

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
};

// Execute command
WinRMHandler.prototype.executeCommand = function (command) {
    const self = this;
    config.command = command;
    return new Promise(function (resolve, reject) {
        D.device.sendWinRMCommand(config, function (output) {
            if (output.error) {
                self.checkError(output);
                reject(output.error);
            } else {
                resolve(output);
            }
        });
    });
};

WinRMHandler.prototype.parseOutputToJson = function (output) {
    const jsonString = output.outcome.stdout;
    return jsonString ? JSON.parse(jsonString) : null;
};

WinRMHandler.prototype.checkIfValidated = function (output) {
    return output.outcome && output.outcome.stdout;
};

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
};

SSHHandler.prototype.executeCommand = function (command) {
    const self = this;
    // SSH gets its own options: the WinRM port/scheme/auth in config must not reach the SSH client,
    // so the sandbox uses the device SSH port (22 by default).
    const sshConfig = {
        username: config.username,
        password: config.password,
        timeout: config.timeout,
        command: 'powershell -Command "' + command.replace(/"/g, '\\"') + '"'
    };
    return new Promise(function (resolve, reject) {
        D.device.sendSSHCommand(sshConfig, function (output, error) {
            if (error) {
                self.checkError(output, error);
                reject(error);
            } else {
                resolve(output);
            }
        });
    });
};

SSHHandler.prototype.parseOutputToJson = function (output) {
    return output ? JSON.parse(output) : null;
};

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined;
};
