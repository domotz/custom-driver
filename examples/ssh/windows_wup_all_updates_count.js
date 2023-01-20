/**
* Domotz Custom Driver 
 * Name: Windows Update - All Updates Count
 * Description: Shows the number of updates available listed by their severity
 * 
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Table with the following columns:
 *   - Id
 *   - Update Type
 *   - no. updates to be installed
 */

// The ssh options for windows update info retrieval
var command ="powershell -command \"$UpdateSession = New-Object -ComObject Microsoft.Update.Session;$UpdateSearcher = $UpdateSession.CreateupdateSearcher();$Updates = @($UpdateSearcher.Search('IsHidden=0 and IsInstalled=0 and AutoSelectOnWebSites=1').Updates);$Updates| Group-Object MsrcSeverity |select name,count | sort name -Descending|ConvertTo-Json\""

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
        "Missing Updates Count",
        [
            { label: "Updates to be installed"}
        ]
    );
    var json = JSON.parse(output)
    var i=0;
    while (i < json.length) {
        var uid = i.toString();
        var type =  json[i].Name;
        var count = json[i].Count;
        if (!type) {
            type = "Unspecified";
        }
        table.insertRecord(
            type, [count]
        );
        i++;
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
