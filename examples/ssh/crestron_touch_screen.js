/**
 * Domotz Custom Driver 
 * Name: Crestron Touch Screen Monitoring 
 * Description: This drivers monitors all info sensors and temperature sensors and add a reboot button to the driver page.
 * 
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Table with the following columns:
 *  - Sensor
 *  - Value
**/
// Define the commands to be run over SSH
var cmdTemperature="temperature";
var cmdInfo="info";
var cmdReboot="reboot";

// Define the SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

// Check for Errors on the SSH command response
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command){
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if(err) checkSshError(err);
        d.resolve(out);
    });
    return d.promise;
}

/**
* @remote_procedure
* @label Reboot
* @documentation WARNING!! This button does not provide with a confirmation dialogue. It will reboot the device immediately once pressed.
*/
function custom_1() {
    // Command to issued when pressing the button
    executeCommand(cmdReboot).then(function(){
        D.success();
    });
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(cmdTemperature).then(function(){
        D.success();
    });
}

// Create the table definition
var touchScreenSensorTable = D.createTable(
    "Touchscreen Sensors",
    [
        { label: "Sensor" },
        { label: "Value" }
    ]
);

function parseData(executionResult){
    // result is an array
    // cmdTemperature output is result[0]
    // cmdInfo output is result[1]
    // concatenating the results into one output
    output = executionResult[0]+executionResult[1];
    // processing the output
    var outputArray = output.split(/\r?\n/);
    if (outputArray == null) {
        console.error("Commands output is empty or undefined");
        D.failure(D.errorType.PARSING_ERROR); 
    }
    for (var i = 0; i < outputArray.length - 1; i++) {
        // removing whitespaces
        var fields = outputArray[i].replace(/\s+/g," ").trim();
        // removing prompts characters before ">"
        fields = fields.substring(fields.indexOf(">") + 1);

        if (fields != "") {
            //splitting fields using ":" as separator
            var sensorArray = fields.split(":");
            var sensorName = sensorArray[0];
            if (sensorName == null) {
                console.error("fieldsArray[0] is empty  or undefined");
                D.failure(D.errorType.PARSING_ERROR); 
            }
            //creating the id field for the table by concat "id-" with the first element of the array
            var recordId="id-" + sensorName.replace(/\s/g, "-").toLowerCase();
            var sensorValue = sensorArray[sensorArray.length - 1];

            if (sensorName.indexOf("Temperature") >= 0) {
                sensorName = sensorName + " - C";
                sensorValue = sensorValue.slice(0, -1);
            } else if (sensorName.indexOf("Web") >=0  || sensorName.indexOf("FTP") >=0 || sensorName.indexOf("SSL") >= 0 || sensorName.indexOf("RConsole") >=0 || sensorName.indexOf("System") >= 0) {
                sensorValue = sensorArray[1] + sensorValue;
            }
            touchScreenSensorTable.insertRecord(
                recordId, [sensorName, sensorValue]
            );
        } 
    }
    return touchScreenSensorTable;
}
/**
* @remote_procedure
* @label Get Touch Screen Sensor Data
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    D.q.all([
        executeCommand(cmdTemperature),
        executeCommand(cmdInfo)
    ])
        .then(parseData)
        .then(function(touchScreenSensorTable){
            D.success(touchScreenSensorTable);
        });
}
