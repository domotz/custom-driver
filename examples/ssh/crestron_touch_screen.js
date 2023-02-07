/**
 * Domotz Custom Driver 
 * Name: Crestron Touch Screen Monitoring 
 * Description: This drivers monitors Front Panel Slot and Core3UILevel sensors
 * 
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Table with the following colums:
 *  - Sensor
 *  - Value
**/

// Ssh options and command to be run
var command ="info"
var options = {
    "command": command,
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 5000
};

// Helper function to parse the device response and call the success callback
function successCallback(output) {
    // Creation of custom driver table 
    var table = D.createTable(
        "Touchscreen Sensors",
        [
            { label: "Sensor" },
            { label: "Value" }
        ]
    );

    var outputArr = output.split(/\r?\n/);
    if (outputArr == null) {
        console.error("outputArr is empty or undefined")
        D.failure(D.errorType.GENERIC_ERROR) 
    }
    var outputArrLen = outputArr.length;

    for (var i = 0; i < outputArrLen; i++) {
        var fields = outputArr[i].replace(/\s+/g,' ').trim();

        if (fields == "") {
            console.info("line empty, skipping")
        }
        else {
            var fieldsArr = fields.split(":");

            if (fieldsArr[0] == null) {
                console.error("fieldsArray[0] is empty  or undefined")
                D.failure(D.errorType.GENERIC_ERROR) 
            }
            
            var recordId='id-'+fieldsArr[0].replace(/\s/g, '-').toLowerCase();


            if (fieldsArr.includes("Front Panel Slot")) {
            const lastElement = fieldsArr[fieldsArr.length - 1];

            table.insertRecord(
                recordId, ["Front Panel Slot", lastElement]
            )
            }

            if (fieldsArr.includes("Core3UILevel")) {
            const lastElement = fieldsArr[fieldsArr.length - 1];

            table.insertRecord(
                recordId, ["Core3 UI Level", lastElement]
            )
            }
        }
    } 

D.success(table);
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
* @documentation Verifies if the driver can be applied on the device. Checks for credentials and for 
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    D.device.sendSSHCommand(options, commandExecutionCallback);
}

/**
* @remote_procedure
* @label Get Variables
* @documentation Creates custom driver table with defined sensors
*/
function get_status() {
    D.device.sendSSHCommand(options, commandExecutionCallback);
}