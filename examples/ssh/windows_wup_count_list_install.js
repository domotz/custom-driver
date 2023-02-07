/**
* Domotz Custom Driver 
 * Name: Windows Update - Count, List, and Install updates
 * Description: Shows the number of updates available listed by their severity, shows a list of the updates, provides a button to install them on demand
 * 
 * Please note that to be able to use the button in custom_1 function so to install updates if you are not using an Administrative user
 * please see this online thread: https://social.technet.microsoft.com/Forums/azure/en-US/969b16c7-bd7a-4204-9ae0-b5a5d7663d14/how-to-allow-nonadministrator-install-windows-update?forum=winserverGP
 * 
 * Communication protocol is SSH.
 * 
 * Creates a Variable Section with 
 *  - Severity
 *  - Number of Updates
 * 
 * Creates Custom Driver Table with the following columns:
 *   - Id (Microsoft KB)
 *   - Title
 *   - Severity
 *   - Categories
 *   - URL (on microsoft website)
 */

// The ssh options for windows update info retrieval
var command ="powershell -command \"$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = @($UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates);$Updates| select  @{n='KB';e={$($_.KBArticleIDs) -join ','}},title,MsrcSeverity,@{n='Category';e={[array](($_.Categories | select Name).Name) -join '|'}}, @{n='URL';e={$($_.moreinfourls) -join ' - '}}|ConvertTo-Json\""
var options = {
    "command": command,
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 20000 
};

// Helper function to parse the windows update info response and call the success callback
function successCallback(output) {
    // Creation of custom driver table 
    var table = D.createTable(
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

    var k = 0;
    if (!output) {
        output = '[{"KB" : "None", "Title" : "None","MsrcSeverity" : "None" ,"Category" : "None","URL" : "None"}]'
    }
    var json = JSON.parse(output);
    while (k < json.length) {
        var uid = 'KB' + json[k].KB;
        var title = json[k].Title;
        var severity = json[k].MsrcSeverity;
        var category = json[k].Category;
        var url = json[k].URL ;
        if (!uid) {
            uid = 'Unspecified-' + k
        }
        if (!severity) {
            severity = 'Unspecified'
        }
        switch(severity) {
        case 'Critical':
            CriticalCount++;
            break;

        case 'Important':
            ImportantCount++;
            break;
      
        case 'Low':
            LowCount++;
            break;
    
        case 'Moderate':
            ModerateCount++;
         break;
		
        case 'Unspecified':
            UnspecifiedCount++;
            break;
		
        default:
        }

        table.insertRecord(
            uid, [title, severity, category, url]
        );
        k++;
    }
    dCritical = D.createVariable('4','Critical',CriticalCount,'',D.valueType.NUMBER);
    dImportant = D.createVariable('3','Important',ImportantCount,'',D.valueType.NUMBER);
    dLow = D.createVariable('2','Low',LowCount,'',D.valueType.NUMBER);
    dModerate = D.createVariable('1','Moderate',ModerateCount,'',D.valueType.NUMBER);
    dUnspecified = D.createVariable('0','Unspecified',UnspecifiedCount,'',D.valueType.NUMBER);
    D.success([dCritical,dImportant,dLow,dModerate,dUnspecified],table);
}

/**
* SSH Command execution Callback
* Checks for errors: Parsing, Authentication, Generic
* Calls success callback on ssh output
*/
function commandExecutionCallback(output, error) {
    //console.info("Execution: ", output);
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
            successCallback(output);
        }
    }
}


/**
* @remote_procedure
* @label Validate Association
* @documentation Verifies if the driver can be applied on the device. Checks for credentials
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    D.device.sendSSHCommand(options, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Get Variables
* @documentation Creates WUP variables section and custom driver table
*/
function get_status() {
    D.device.sendSSHCommand(options, commandExecutionCallback);
}


/**
* @remote_procedure
* @label Install Updates
* @documentation WARNING!! This button does not provide with a confirmation dialogue: it will install all the missing udates from the list, but does not reboot the host.
*/
function custom_1(){

    // Command to issued when pressing the button
    option.command="powershell -c \"$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = $UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates;$Downloader = $UpdateSession.CreateUpdateDownloader();$Downloader.Updates = $Updates;$Downloader.Download();$Installer = New-Object -ComObject Microsoft.Update.Installer;$Installer.Updates = $Updates;$Result = $Installer.Install()\""
    D.device.sendSSHCommand(options, commandExecutionCallback);

}