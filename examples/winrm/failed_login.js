/**
 * Domotz Custom Driver
 * Name: Windows Failed Logon attempts
 * Description: monitors the failed logon on a Windows computer
 *
 * Communication protocol is WinRM
 *
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 * Creates a Custom Driver Variable with the number of failed logons and a custom table with a summary of target users
 *
 * Privilege required:
 * - Read permissions on HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\EventLog\Security
 * - Membership of builtin group "Event Log Readers"
 *
 * Requirements:
 *      - WinRM Enabled: To run the script using WinRM
 *      - SSH Enabled: To run the script using SSH
 **/

// Set the number of hours to look back for failed logon attempts
const hours = D.getParameter("hours");

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const sshProtocolIsSelected = protocol.toLowerCase() === "ssh";

const sendCommand = sshProtocolIsSelected ? D.device.sendSSHCommand : D.device.sendWinRMCommand;

// Command to retrieve failed login attempts
const winrmCommand = '$Hours=' + hours + ';$events=Get-WinEvent -FilterHashTable @{LogName="Security";ID=4625;StartTime=((Get-Date).AddHours(-($Hours)).Date);EndTime=(Get-Date)} -ErrorAction SilentlyContinue;$GroupByUsers = $events | ForEach-Object {[PSCustomObject]@{TimeCreated = $_.TimeCreated;TargetUserName = $_.properties[5].value;WorkstationName = $_.properties[13].value;IpAddress = $_.properties[19].value }} | Group-Object -Property TargetUserName | Sort-Object -Property Count -Descending;$GroupByUsers |select count,values |ConvertTo-Json';

// Define winrm configuration
const winrmConfig = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

const failedLogonTable = D.createTable(
    "Failed logon attempts by account",
    [
        { label: "last " + hours + " hour(s)" }
    ]
);

/**
 * Checks for errors in the WinRM command response and handles them accordingly.
 * @param {Object} err - The error object returned by the command.
 */
function checkWinRmError(err) {
    if (err.message) console.error(err.message);
    if (err.code === 401) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code === 404) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
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
 * Parses the output of a system command that lists failed logon attempts for the last specified number of hours.
 * @param jsonOutput
 */
function parseOutput(jsonOutput) {
    let totFailed = 0;
    for (let i = 0; i < jsonOutput.length; i++) {
        const count = jsonOutput[i].Count;
        const values = jsonOutput[i].Values[0];
        failedLogonTable.insertRecord(values, [count]);
        totFailed += count;
    }
    const totFailedLogon = [D.device.createVariable("FailedLogonAttempts", "Total failed attempts", totFailed, null, D.valueType.NUMBER)];
    D.success(totFailedLogon, failedLogonTable);
}

/**
 * @remote_procedure
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    winrmConfig.command = convertCmdToTheRightProtocol('Get-WinEvent -LogName "Security" -MaxEvents 1');
    sendCommand(winrmConfig, validateCallback);
}

/**
 * @remote_procedure
 * @label Get Host failed logon for the last hours
 * @documentation This procedure retrieves last hour failed logon attempts
 */
function get_status() {
    winrmConfig.command = convertCmdToTheRightProtocol(winrmCommand);
    sendCommand(winrmConfig, getStatusCallback);
}