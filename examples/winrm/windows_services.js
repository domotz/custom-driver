/**
 * Domotz Custom Driver
 * Name: Windows Services Monitoring
 * Description: Monitors the status of services on a Windows machine
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 * Create a Custom Driver table with a list of services, their status and their start type
 *
 * Privilege required: Local Administrator
 * requirements:
 *      - WinRM Enabled: To run the script using WinRM
 *      - SSH Enabled: To run the script using SSH
 **/

// List of services you want to monitor, note that you can put the DisplayName or the ServiceName
// For Windows 10 computer (workstation) you may want to set the filter the following way:
// var svcFilter = ["dhcp", "dnscache", "LanmanServer", "MpsSvc", "RpcEptMapper", "schedule", "Windows Time"]
// For a server you may want to set the filter the following way:
const svcFilter = D.getParameter('servicesFilter');

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

/**
 * Generates a PowerShell command to retrieve service information based on the service filter.
 * @returns {string}
 */
function generateGetServicesCmd() {
    if (svcFilter !== '$null') {
        const svcFilterString = svcFilter.join('","').replace(/\$/g, '`$');
        return 'ConvertTo-Json @(@("' + svcFilterString + '") | Get-Service | Select-Object ServiceName,DisplayName,Status,StartType)';
    }
    return ''
}

// Define the WinRM options when running the commands
const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

const statusCodes = {
    "1": "Stopped",
    "2": "StartPending",
    "3": "StopPending",
    "4": "Running",
    "5": "ContinuePending",
    "6": "PausePending",
    "7": "Paused"
};
const startTypes = {
    "0": "Boot",
    "1": "System",
    "2": "Automatic",
    "3": "Manual",
    "4": "Disabled"
};

const svcTable = D.createTable(
    "Monitored services",
    [
        {label: "Service Name"},
        {label: "Status"},
        {label: "Start Type"}
    ]
);

function populateTable(service) {
    const svcName = service.ServiceName
    const status = statusCodes[service.Status.toString()]
    const startType = startTypes[service.StartType.toString()]

    const recordID = service.DisplayName.slice(0, 50);
    svcTable.insertRecord(recordID, [svcName, status, startType]);
}

function parseOutput(listOfServices) {
    for (let k = 0; k < listOfServices.length; k++) {
        populateTable(listOfServices[k]);
    }
    D.success(svcTable);
}

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
 * @label Validate is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials and privileges provided
 */
function validate() {
    instance.executeCommand("Get-Service eventlog")
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get the selected services data
 * @documentation This procedure retrieves data for the selected services
 */
function get_status() {
    instance.executeCommand(generateGetServicesCmd())
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
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