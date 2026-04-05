/**
 * Domotz Custom Driver
 * Name: Windows current sessions
 * Description: monitor current logged in users on a Windows computer
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
 *
 * Dynamically create table with columns specified in usersTable variable
 * Return a table with these columns:
 * -------------------------------------
 *    State: The state of the user session, such as active or disconnected.
 *    Logon Time: The time when the user session was logged on to the system.
 *    Session ID: The ID of the user session.
 *    Idle Time: The duration of time the user session has been idle.
 *    Session Name: The name of the user session.
 * -------------------------------------
 *
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * PowerShell Version:
 *      - 5.1.19041.2364
 *
 *  Requirements:
 *    - WinRM Enabled: To run the script using WinRM
 *    - SSH Enabled: To run the script using SSH
 *
 * Creates a Custom Driver table with the list of current logged-in users
 *
 * Privilege required: Administrator
 *
 **/

// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

const command = 'Start-Process quser -NoNewWindow -RedirectStandardError "NUL"'

// Define winrm configuration
const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};
const usersTable = D.createTable(
    "Logged In Users",
    [
        {label: "Username"},
        {label: "State"},
        {label: "Logon Time"},
        {label: "Session ID"},
        {label: "Idle Time"},
        {label: "Session Name"}
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
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    instance.executeCommand(command)
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Get Host current user sessions
 * @documentation This procedure retrieves current logged-in users data
 */
function get_status() {
    instance.executeCommand(command)
        .then(instance.parseOutputToArray)
        .then(parseOutput)
        .catch(instance.checkError);
}

function sanitize(output) {
    const recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    const recordIdSanitizationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitizationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

/**
 * Parses the output of a system command that lists logged-in users and adds the relevant information to a table.
 * @param {Object} output The output of the system command, including stdout and an error object.
 */
function parseOutput(output) {
    let k = 1;
    while (k < output.length) {
        let line = output[k];
        if (line !== "") {
            line = line.replace(/\s\s+/g, " ");
            const words = line.split(" ").slice(1);
            let idxOffset = 0;
            let sessionName = "";
            if (words.length !== 7) {
                sessionName = words[1];
                idxOffset = 1;
            }
            const username = words[0];
            const recordId = sanitize(username);
            const sessionId = words[1 + idxOffset];
            const status = words[2 + idxOffset];
            const idleTime = words[3 + idxOffset];
            const logonTime = words[4 + idxOffset] + " " + words[5 + idxOffset] + " " + words[6 + idxOffset];
            usersTable.insertRecord(recordId, [username, status, logonTime, sessionId, idleTime, sessionName]);
        }
        k++;
    }
    D.success(usersTable);

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

WinRMHandler.prototype.parseOutputToArray = function (output) {
    return output.outcome.stdout.trim().split(/\r?\n/);
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

SSHHandler.prototype.parseOutputToArray = function (output) {
    return output.trim().split(/\r?\n/);
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}