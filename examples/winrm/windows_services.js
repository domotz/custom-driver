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
 *
 **/

// List of services you want to monitor, note that you can put the DisplayName or the ServiceName
// For Windows 10 computer (workstation) you may want to set the filter the following way:
// var svcFilter = ["dhcp", "dnscache", "LanmanServer", "MpsSvc", "RpcEptMapper", "schedule", "Windows Time"]
// For a server you may want to set the filter the following way:
const svcFilter = D.getParameter('servicesFilter');

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const sshProtocolIsSelected = protocol.toLowerCase() === "ssh";

const sendCommand = sshProtocolIsSelected ? D.device.sendSSHCommand : D.device.sendWinRMCommand;


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
const winrmConfig = {
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

/**
 * Checks for errors in the WinRM command response and handles them accordingly.
 * @param {Object} err - The error object returned by the command.
 */
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code === 401) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Checks for errors in the SSH command response and handles them accordingly.
 * @param {Object} err - The error object returned by the command.
 */
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code === 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code === 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * Parses the output string to a JSON object.
 * @param {string|Object} output - The output to be parsed.
 * @returns {Object} The parsed JSON object.
 */
function parseOutputToJson(output) {
    return typeof (output) === "string" ? JSON.parse(output) : JSON.parse(JSON.stringify(output));
}

/**
 * Extracts the result from the JSON output and processes any errors in the stderr.
 * @param {Object} jsonOutput - The JSON output from the command.
 * @returns {Object} The extracted result, or the original output if no result is found.
 */
function extractResultFromOutput(jsonOutput) {
    if (jsonOutput.outcome && jsonOutput.outcome.stdout) {
        const stderr = jsonOutput.outcome.stderr;
        if (stderr !== null) {
            const errorList = stderr.split('Get-Service :');
            for (let j = 0; j < errorList.length; j++) {
                if (errorList[j] !== '') {
                    console.error(errorList[j]);
                }
            }
        }
        return JSON.parse(jsonOutput.outcome.stdout)
    }
    return jsonOutput
}

/**
 * Converts the command to the appropriate protocol format based on the selected protocol.
 * @param {string} cmd - The command to be converted.
 * @returns {string} The command in the correct protocol format.
 */
function convertCmdToTheRightProtocol(cmd) {
    return sshProtocolIsSelected ? 'powershell -Command "' + cmd.replace(/"/g, '\\"') + '"' : cmd;
}

/**
 * Processes the output by extracting the result and parsing it.
 * @param {string} output - The raw output to be processed.
 */
function processOutput(output) {
    parseOutput(extractResultFromOutput(parseOutputToJson(output)));
}

/**
 * Checks for errors in the command and calls the appropriate error handler.
 * @param {Object} error - The error object returned by the command.
 * @param {Object} output - The output returned by the command.
 */
function checkError(error, output) {
    if (sshProtocolIsSelected) {
        checkSshError(error);
    } else {
        checkWinRmError(output);
    }
}

/**
 * Validates the callback response by checking for errors or confirming success.
 * @param {Object} output - The output returned by the command.
 * @param {Object} error - The error object returned by the command (if any).
 */
function validateCallback (output, error) {
    if (error) {
        checkError(error, output);
    } else {
        console.info("Validation successful.");
        D.success();
    }
}

/**
 * Callback function for handling the command execution.
 * @param {Object} output - The output returned by the command.
 * @param {Object} error - The error object returned by the command.
 * */
function getStatusCallback (output, error) {
    if (error) {
        checkError(error, output);
    } else {
        processOutput(output);
    }
}

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials and privileges provided
 */
function validate() {
    winrmConfig.command = convertCmdToTheRightProtocol("Get-Service eventlog");
    sendCommand(winrmConfig, validateCallback);
}

/**
 * @remote_procedure
 * @label Get the selected services data
 * @documentation This procedure retrieves data for the selected services
 */
function get_status() {
    winrmConfig.command = convertCmdToTheRightProtocol(generateGetServicesCmd());
    sendCommand(winrmConfig, getStatusCallback);
}

function populateTable(svcName, displayName, status, startType) {
    const recordID = displayName.slice(0, 50);
    status = statusCodes[status];
    startType = startTypes[startType];
    svcTable.insertRecord(recordID, [svcName, status, startType]);
}

function parseOutput(listOfServices) {
    for (let k = 0; k < listOfServices.length; k++) {
        populateTable(
            listOfServices[k].ServiceName,
            listOfServices[k].DisplayName,
            listOfServices[k].Status.toString(),
            listOfServices[k].StartType.toString()
        );
    }
    D.success(svcTable);
}