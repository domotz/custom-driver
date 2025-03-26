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

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// Command to retrieve failed login attempts
const winrmCommand = '$Hours=' + hours + ';$events=Get-WinEvent -FilterHashTable @{LogName="Security";ID=4625;StartTime=((Get-Date).AddHours(-($Hours)).Date);EndTime=(Get-Date)} -ErrorAction SilentlyContinue;$GroupByUsers = $events | ForEach-Object {[PSCustomObject]@{TimeCreated = $_.TimeCreated;TargetUserName = $_.properties[5].value;WorkstationName = $_.properties[13].value;IpAddress = $_.properties[19].value }} | Group-Object -Property TargetUserName | Sort-Object -Property Count -Descending;$GroupByUsers |select count,values |ConvertTo-Json';

// configuration
const config = {
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
 * Parses the output of a system command that lists failed logon attempts for the last specified number of hours.
 * @param jsonOutput
 */
function parseOutput(jsonOutput) {
    let totFailed = 0;

    function processRow(row) {
        const count = row.Count;
        const values = row.Values[0];
        failedLogonTable.insertRecord(values, [count]);
        totFailed += count;
    }

    if(typeof jsonOutput === "object"){
        processRow(jsonOutput)
    }else{
        for (let i = 0; i < jsonOutput.length; i++) {
            processRow(jsonOutput[i]);
        }
    }

    const totFailedLogon = [D.device.createVariable("FailedLogonAttempts", "Total failed attempts", totFailed, null, D.valueType.NUMBER)];
    D.success(totFailedLogon, failedLogonTable);
}


function parseValidateOutput (isValidated) {
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
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    instance.executeCommand('Get-WinEvent -LogName "Security" -MaxEvents 1')
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Host failed logon for the last hours
 * @documentation This procedure retrieves last hour failed logon attempts
 */
function get_status() {
    instance.executeCommand(winrmCommand)
        .then(function (output){
            const jsonOutput = instance.parseOutputToJson(output)
            instance.logServiceErrors(jsonOutput)
            return jsonOutput
        })
        .then(parseOutput)
        .catch(instance.checkError);
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

WinRMHandler.prototype.logServiceErrors = function (jsonOutput) {
    if (jsonOutput.outcome && jsonOutput.outcome.stderr) {
        const stderr = jsonOutput.outcome.stderr;
        if (stderr !== null) {
            const errorList = stderr.split('Get-Service :');
            for (let j = 0; j < errorList.length; j++) {
                if (errorList[j] !== '') {
                    console.error(errorList[j]);
                }
            }
        }
    }
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

SSHHandler.prototype.logServiceErrors = function (jsonOutput) {}