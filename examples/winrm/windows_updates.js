/**
 * Domotz Custom Driver 
 * Name: Windows Updates
 * Description: Reports on the missing updates
 *   
 * Communication protocol is WinRM
 * 
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates the following:
 *  - Variables with a break-down of categories and classifications of missing updates
 *  - Table with the list of missing updates data
 * 
 * Privilege required: 
 * - User
 */

var CriticalCount = 0;
var ImportantCount = 0;
var LowCount = 0;
var ModerateCount = 0;
var UnspecifiedCount = 0;
var SecurityCount = 0;

var winrmConfig = {
    "username": D.device.username(),
    "password": D.device.password()
};

// Creation of custom driver table 
var missingUpdatesTable = D.createTable(
    "Missing Updates",
    [
        { label: "Title" },
        { label: "Severity" },
        { label: "Categories" },
        { label: "URL" }
    ]
);

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
 * @label Validate WinRM is working on device
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
 */
function validate() {
    winrmConfig.command = "Get-HotFix";
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
 * @label Retrieve list of missing updates
 * @documentation This procedure retrieves a list of missing updates for the target device
 */
function get_status() {
    winrmConfig.command = "$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = @($UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates);$Updates| select  @{n='KB';e={$($_.KBArticleIDs) -join ','}},title,MsrcSeverity,@{n='Category';e={[array](($_.Categories | select Name).Name) -join '|'}}, @{n='URL';e={$($_.moreinfourls) -join ' - '}}|ConvertTo-Json";
    D.device.sendWinRMCommand(winrmConfig, parseOutput);
}

/**
 * @description Parses the output of the WinRM command and fill the missing updates table and severity counter variables.
 * @param {object} output - The output of the WinRM command.
 */
function parseOutput(output) {
    if (output.error === null) {
        if (output.outcome.stdout) {
            var jsonOutput = JSON.parse(JSON.stringify(output));
            jsonOutput = JSON.parse(jsonOutput.outcome.stdout);
            var k = 0;
            while (k < jsonOutput.length) {
                var recordId = "KB" + jsonOutput[k].KB;
                var title = jsonOutput[k].Title;
                var severity = jsonOutput[k].MsrcSeverity || "Unspecified";
                var category = jsonOutput[k].Category;
                var url = jsonOutput[k].URL;
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
        }
        var updateSeverityCounterVariables = [
            D.createVariable("0-severity-unspecified", "Severity - Unspecified", UnspecifiedCount, null, D.valueType.NUMBER),
            D.createVariable("1-severity-moderate", "Severity - Moderate", ModerateCount, null, D.valueType.NUMBER),
            D.createVariable("2-severity-low", "Severity - Low", LowCount, null, D.valueType.NUMBER),
            D.createVariable("3-severity-important", "Severity - Important", ImportantCount, null, D.valueType.NUMBER),
            D.createVariable("4-severity-critical", "Severity - Critical", CriticalCount, null, D.valueType.NUMBER),
            D.createVariable("99-category-security", "Category - Security", SecurityCount, null, D.valueType.NUMBER),
        ];
        D.success(updateSeverityCounterVariables, missingUpdatesTable);
    } else {
        console.error(output.error);
        D.failure();
    }
}
