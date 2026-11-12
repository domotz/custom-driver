/**
 * Domotz Custom Driver 
 * Name: Windows Update - Count, List, and Install Missing Updates
 * Description: Shows the number of updates available listed by their severity or category, provides a button to install them on demand
 * 
 * Please note that to be able to use the button 'Install Updates' you must be using an Administrative user
 * please see this online thread: https://social.technet.microsoft.com/Forums/azure/en-US/969b16c7-bd7a-4204-9ae0-b5a5d7663d14/how-to-allow-nonadministrator-install-windows-update?forum=winserverGP
 * 
 * Communication protocol is SSH. Utilizing the native windows powershell command
 * 
 * Tested on Windows Versions:
 *      - Windows 10
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 * 
 * Creates custom driver variables for missing updates severity counts:
 *  - Severity Critical
 *  - Severity Important
 *  - Severity Low
 *  - Severity Moderate
 *  - Severity Unspecified
 *  - Category Security
 *
 * Creates Custom Driver Table with the following columns:
 *   - Id (Microsoft KB)
 *   - Title
 *   - Severity
 *   - Categories
 *   - URL (microsoft website)
 */


var getWindowsUpdatesCommand = "powershell -command \"$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = @($UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates);$Updates| select  @{n='KB';e={$($_.KBArticleIDs) -join ','}},title,MsrcSeverity,@{n='Category';e={[array](($_.Categories | select Name).Name) -join '|'}}, @{n='URL';e={$($_.moreinfourls) -join ' - '}}|ConvertTo-Json\"";
var sshOptions = {
    "command": getWindowsUpdatesCommand,
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 40000
};

// Helper function to parse the windows update info response and call the success callback
function dataParserCallback(output) {
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
    var CriticalCount = 0;
    var ImportantCount = 0;
    var LowCount = 0;
    var ModerateCount = 0;
    var UnspecifiedCount = 0;
    var SecurityCount = 0;

    var k = 0;
    if (!output) {
        // If there are no missing updates, we need to update the table accordingly
        output = "[{\"KB\" : \"None\", \"Title\" : \"None\",\"MsrcSeverity\" : \"None\" ,\"Category\" : \"None\",\"URL\" : \"None\"}]";
    }
    var jsonOutput = JSON.parse(output);
    while (k < jsonOutput.length) {
        var recordId = "KB" + jsonOutput[k].KB;
        var title = jsonOutput[k].Title;
        var severity = jsonOutput[k].MsrcSeverity || "Unspecified";
        var category = jsonOutput[k].Category;
        var url = jsonOutput[k].URL ;
        
        if (category.indexOf("Security") >= 0) {
            SecurityCount++ ;
        }
        switch(severity) {
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
    var updateSeverityCounterVariables = [
        D.createVariable("0-severity-unspecified", "Severity - Unspecified", UnspecifiedCount, null, D.valueType.NUMBER),
        D.createVariable("1-severity-moderate", "Severity - Moderate", ModerateCount, null, D.valueType.NUMBER),
        D.createVariable("2-severity-low", "Severity - Low", LowCount, null, D.valueType.NUMBER),
        D.createVariable("3-severity-important", "Severity - Important", ImportantCount, null, D.valueType.NUMBER),
        D.createVariable("4-severity-critical", "Severity - Critical", CriticalCount, null, D.valueType.NUMBER),
        D.createVariable("99-category-security", "Category - Security", SecurityCount, null, D.valueType.NUMBER),
    ];
    D.success(updateSeverityCounterVariables,missingUpdatesTable);
}
/**
* SSH Command execution Callback
* Checks for errors: Parsing, Authentication, Generic
* Calls success callback on ssh output
*/
function commandExecutionCallback(output, error) {
    if (error) {
        console.error("Error: ", error);
        if (error.message && (error.message.indexOf("Invalid") === -1 || error.message.indexOf("Handshake failed") === -1)) {
            D.failure(D.errorType.AUTHENTICATION_ERROR);
        } else {
            console.error(error);
            D.failure(D.errorType.GENERIC_ERROR);
        }
    } else {
        if (output && output.indexOf("command not found") !== -1) {
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            dataParserCallback(output);
        }
    }
}

/**
* @remote_procedure
* @label Validate Association
* @documentation Verifies if the driver can be applied on the device. Checks for credentials
*/
function validate() {
    D.device.sendSSHCommand(sshOptions, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Get Windows Updates information
* @documentation Creates varibles for missing updates severity and categories. Creates table for detailed view of missing updates
*/
function get_status() {
    D.device.sendSSHCommand(sshOptions, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Install Updates
* @documentation Installs all the missing updates from the list. No reboot is triggered upon completion.
*/
function custom_1(){
    function installUpdatesCallback(output, error) {
        if (error) {
            console.error("Error: ", error);
            if (error.message && (error.message.indexOf("Invalid") === -1 || error.message.indexOf("Handshake failed") === -1)) {
                D.failure(D.errorType.AUTHENTICATION_ERROR);
            } else {
                console.error(error);
                D.failure(D.errorType.GENERIC_ERROR);
            }
        } else {
            if (output && output.indexOf("command not found") !== -1) {
                D.failure(D.errorType.PARSING_ERROR);
            } else {
                D.success();
            }
        }
    }    
    var installMissingUpdates = "powershell -c \"$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = $UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates;$Downloader = $UpdateSession.CreateUpdateDownloader();$Downloader.Updates = $Updates;$Downloader.Download();$Installer = New-Object -ComObject Microsoft.Update.Installer;$Installer.Updates = $Updates;$Result = $Installer.Install()\"";
    sshOptions.command = installMissingUpdates;
    D.device.sendSSHCommand(sshOptions, installUpdatesCallback);

}