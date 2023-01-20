/**
 * Domotz Custom Driver 
 * Name: Windows Update - Security Updates List
 * Description: Shows a list of updates of any severity classified as "Security" 
 * 
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Table with the following columns:
 *   - Id
 *   - Title
 *   - Severity
 *   - URL
 */

// The ssh options for windows update info retrieval
var command ="powershell -command \"$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = @($UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates);$Updates |?{([array](($_.Categories | select Name).Name) -contains 'Security-only update') -or ([array](($_.Categories | select Name).Name) -contains 'Security Updates')}|select @{n='KB';e={$($_.KBArticleIDs) -join ','}},title,MsrcSeverity,@{n='URL';e={$($_.moreinfourls) -join ' - '}}|ConvertTo-Json\""
var options = {
    "command": command,
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 35000
};

// Helper function to parse the windows update info response and call the success callback
function successCallback(output) {
    // Creation of custom driver table 
    var table = D.createTable(
        "Missing Security Updates",
        [
            { label: "Title" },
            { label: "Severity" },
            { label: "URL" }

        ]
    );

    var k = 0;
    if (!output) {
        output = '[{"KB" : "None", "Title" : "None", "Severity" : "None","URL" : "None"}]'
    }
    console.log(output);
    var json = JSON.parse(output);
    while (k < json.length) {
        uid = 'KB' + json[k].KB;
        var title = json[k].Title;
        var category = json[k].Severity;
        var url = json[k].URL ;
        if (!uid) {
            uid = 'Unspecified-' + k
        }

        table.insertRecord(
            uid, [title, category, url]
        );
        k++;
    }
    D.success(table);
}
/**
* SSH Command execution Callback
* Checks for errors: Parsing, Authentication, Generic
* Calls success callback on ssh output
*/
function commandExecutionCallback(output, error) {
    console.info("Execution: ", output);
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
* @documentation Creates WUP custom driver table
*/
function get_status() {
    D.device.sendSSHCommand(options, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Please add a label for the custom_1 function
* @documentation Please add a documentation for the custom_1 function
*/