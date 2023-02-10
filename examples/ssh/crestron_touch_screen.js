/**
 * Domotz Custom Driver 
 * Name: Crestron Touch Screen Monitoring 
 * Description: This drivers monitors Front Panel Slot and Core3UILevel sensors
 * 
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Sensor
 *  - Value
**/

// Ssh options and command to be run
var sshOptions = {
    "command": "info",
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 5000
};

// Helper function to parse the device response and call the success callback
function successCallback(output) {
    // Creation of custom driver table 
    var touchScreenSensorsTable = D.createTable(
        "Touchscreen Sensors",
        [
            { label: "Sensor" },
            { label: "Value" }
        ]
    );

    var commandOutputArray = output.split(/\r?\n/);
    if (commandOutputArray == null) {
        console.error("commandOutputArray is empty or undefined")
        D.failure(D.errorType.PARSING_ERROR) 
    }

    for (var i = 0; i < commandOutputArray.length; i++) {
        if (commandOutputArray[i] == null){
            console.debug("Line empty, skipping")
        }
        else{
            var fieldsArray = commandOutputArray[i].replace(/\s+/g,' ').trim().split(":");

            if (fieldsArray[0] == null) {
                console.error("fieldsArray[0] is empty  or undefined")
                D.failure(D.errorType.PARSING_ERROR) 
            }
            
            var recordId='id-'+fieldsArr[0].replace(/\s/g, '-').toLowerCase();
            var recordValue = fieldsArray[fieldsArray.length - 1];
            if (fieldsArray.includes("Front Panel Slot")) {
                touchScreenSensorsTable.insertRecord(
                    recordId, ["Front Panel Slot", recordValue]
                )
            }
            if (fieldsArray.includes("Core3UILevel")) {
                touchScreenSensorsTable.insertRecord(
                    recordId, ["Core3 UI Level", recordValue]
                )
            }
        }
    } 
    D.success(touchScreenSensorsTable);
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
            successCallback(output);
        }
    }
}

/**
* @remote_procedure
* @label Validate Device is Crestron Touch Screen
* @documentation Verifies if the driver can be applied on the device. Checks for credentials and for 
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    D.device.sendSSHCommand(sshOptions, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Get Sensor Table Variables
* @documentation Creates custom driver table with defined sensors
*/
function get_status() {
    D.device.sendSSHCommand(sshOptions, commandExecutionCallback);
}