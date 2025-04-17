/**
 * Domotz Custom Driver
 * Name: Windows Security events monitoring
 * Description: monitors the occurrences of Windows security events, some events are only raised if the related audit setting is enabled.
 *
 * More info
 *  - https://learn.microsoft.com/en-us/windows/security/threat-protection/auditing/advanced-security-auditing-faq
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 *
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 * Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates a Custom Driver Table with event IDs, Description, Number of Occurrences for the choosen period of time
 *
 * Required permissions:
 *  - Read permissions on HKLM\System\CurrentControlSet\Services\eventlog\Security
 *  - Must be a member of Built-in group "Event Log Readers"
 *
 **/

/**
 * Number of hours to set a time-window starting from present
 * @const number hours
 **/
const hours = 1;


// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

// Define the options when running the commands
const config = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 30000
};

/**
 * Events to monitor
 * @const object auditedEvents
 **/
const auditedEvents = {
    4720: {description: "A user account was created.", count:0 },
    4722: {description: "A user account was enabled.", count:0 },
    4731: {description: "A security-enabled local group was created.", count:0 },
    4732: {description: "A member was added to a security-enabled local group.", count:0 },
    4649: {description: "A replay attack was detected.", count:0 },
    4741: {description: "A computer account was created.", count:0 },
    4625: {description: "An account failed to log on.", count:0 },
    4817: {description: "Auditing settings on object were changed.", count:0 },
    4947: {description: "A change has been made to Windows Firewall exception list. A rule was modified.", count:0 },
    4948: {description: "A change has been made to Windows Firewall exception list. A rule was deleted.", count:0 },
};

const idArray = Object.keys(auditedEvents);

const eventTable = D.createTable(
    "Security events",
    [
        {label: "Description"},
        {label: "Last " + hours + " hour(s) occurrences"}
    ]
);

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
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    const command = "Get-winevent -Logname \"Security\" -Maxevents 1;";
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Windows Security Events Occurrences
 * @documentation This procedure Retrieves the occurrences count of selected Windows security events in the last hour.
 */
function get_status() {
    const command = "$Hours=" + hours + ";$events=Get-WinEvent -FilterHashTable @{LogName=\"Security\";ID=" + idArray + ";StartTime=((Get-Date).AddHours(-($Hours)).Date);EndTime=(Get-Date)} -ErrorAction SilentlyContinue |group id|select name,count;if ($events){$events | ConvertTo-Json} else {@{name=\"\";count=\"0\"}|ConvertTo-Json};";
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

function setAuditedEventCount(event) {
    if(event.Name) auditedEvents[event.Name].count = event.Count
}

// Parses the output of the command and fills the eventTable with the retrieved events.
function parseOutput(jsonOutput) {
    let k = 0;
    if (Array.isArray(jsonOutput)) {
        while (k < jsonOutput.length) {
            setAuditedEventCount(jsonOutput[k]);
            k++;
        }
    } else {
        setAuditedEventCount(jsonOutput);
    }
    // events with no occurrences will appear in the table with a 0 value
    for (eventId in auditedEvents) {
        eventTable.insertRecord(eventId, [auditedEvents[eventId].description, auditedEvents[eventId].count]);
    }
    D.success(eventTable);
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
    const jsonString = output.outcome.stdout
    return jsonString ? JSON.parse(jsonString) : null;
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
    return output ? JSON.parse(output) : null;
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}