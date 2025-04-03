/**
 * Domotz Custom Driver
 * Name: Windows Updates
 * Description: Reports on the missing updates
 *
 * Communication protocol are:
 *      - WinRM
 *      - SSH
 *
 * The communication protocol can be chosen as either SSH or WinRM by specifying it through the "protocol" parameter.
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
 * Creates the following:
 *  - Variables with a break-down of categories and classifications of missing updates
 *  - Table with the list of missing updates data
 *
 * Privilege required:
 * - User
 */
// Specify the communication protocol to be used (SSH or WinRM)
const protocol = D.getParameter('protocol');

const instance = protocol.toLowerCase() === "ssh" ? new SSHHandler() : new WinRMHandler();

const config = {
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 30000
};

// Creation of custom driver table
const missingUpdatesTable = D.createTable(
    "Missing Updates",
    [
        {label: "Title"},
        {label: "Severity"},
        {label: "Categories"},
        {label: "URL"}
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
    instance.executeCommand("Get-HotFix")
        .then(instance.checkIfValidated)
        .then(parseValidateOutput)
        .catch(instance.checkError);
}

/**
 * @remote_procedure
 * @label Retrieve list of missing updates
 * @documentation This procedure retrieves a list of missing updates for the target device
 */
function get_status() {
    const command = "$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = @($UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates);$Updates| select  @{n='KB';e={$($_.KBArticleIDs) -join ','}},title,MsrcSeverity,@{n='Category';e={[array](($_.Categories | select Name).Name) -join '|'}}, @{n='URL';e={$($_.moreinfourls) -join ' - '}}|ConvertTo-Json";
    instance.executeCommand(command)
        .then(instance.parseOutputToJson)
        .then(parseOutput)
        .catch(instance.checkError);
}

/**
 * @description Parses the output of the WinRM command and fill the missing updates table and severity counter variables.
 * @param jsonOutput
 */
function parseOutput(jsonOutput) {
    let CriticalCount = 0;
    let ImportantCount = 0;
    let LowCount = 0;
    let ModerateCount = 0;
    let UnspecifiedCount = 0;
    let SecurityCount = 0;

    let k = 0;
    while (k < jsonOutput.length) {
        const recordId = "KB" + jsonOutput[k].KB;
        const title = jsonOutput[k].Title;
        const severity = jsonOutput[k].MsrcSeverity || "Unspecified";
        const category = jsonOutput[k].Category;
        const url = jsonOutput[k].URL;
        if (category.indexOf("Security") >= 0) {
            SecurityCount++;
        }
        switch (severity) {
            case "Critical":
                CriticalCount++;
                break;
            case "Important":
                ImportantCount++;
                break;
            case "Low":
                LowCount++;
                break;
            case "Moderate":
                ModerateCount++;
                break;
            case "Unspecified":
                UnspecifiedCount++;
                break;
            default:
        }
        missingUpdatesTable.insertRecord(
            recordId, [title, severity, category, url]
        );
        k++;
    }
    const updateSeverityCounterVariables = [
        D.createVariable("0-severity-unspecified", "Severity - Unspecified", UnspecifiedCount, null, D.valueType.NUMBER),
        D.createVariable("1-severity-moderate", "Severity - Moderate", ModerateCount, null, D.valueType.NUMBER),
        D.createVariable("2-severity-low", "Severity - Low", LowCount, null, D.valueType.NUMBER),
        D.createVariable("3-severity-important", "Severity - Important", ImportantCount, null, D.valueType.NUMBER),
        D.createVariable("4-severity-critical", "Severity - Critical", CriticalCount, null, D.valueType.NUMBER),
        D.createVariable("99-category-security", "Category - Security", SecurityCount, null, D.valueType.NUMBER),
    ];
    D.success(updateSeverityCounterVariables, missingUpdatesTable);
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
    return JSON.parse(output);
}

SSHHandler.prototype.checkIfValidated = function (output) {
    return output !== undefined
}