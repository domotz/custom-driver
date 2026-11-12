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
var cmdTemperature = "temperature";
var cmdInfo = "info";
var cmdReboot = "reboot";

// Define the SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

// Check for Errors on the SSH command response
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) return D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255) return D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function executeCommand(command) {
    sshConfig.command = command;
    return new Promise(function (resolve, reject) {
        D.device.sendSSHCommand(sshConfig, function (out, err) {
            if (err) return reject(err);
            resolve(out);
        });
    });
}

/**
* @remote_procedure
* @label Reboot
* @documentation WARNING!! This button does not provide with a confirmation dialogue. It will reboot the device immediately once pressed.
*/
function custom_1() {
    // Command to issued when pressing the button
    executeCommand(cmdReboot).then(function () {
        D.success();
    }).catch(checkSshError);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(cmdTemperature).then(function () {
        D.success();
    }).catch(checkSshError);
}

// Create the table definition
var touchScreenSensorTable = D.createTable(
    "Touchscreen Sensors",
    [
        { label: "Sensor" },
        { label: "Value" }
    ]
);

function parseData(executionResult) {
    // result is an array
    // cmdTemperature output is result[0]
    // cmdInfo output is result[1]
    // concatenating the results into one output
    // the collector trims each output, so keep a line break between them
    var output = executionResult[0] + "\n" + executionResult[1];
    // processing the output
    var outputArray = output.split(/\r?\n/);
    if (outputArray == null) {
        console.error("Commands output is empty or undefined");
        D.failure(D.errorType.PARSING_ERROR);
    }
    for (var i = 0; i < outputArray.length; i++) {
        // removing whitespaces
        var fields = outputArray[i].replace(/\s+/g, " ").trim();
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
            var recordId = "id-" + sensorName.replace(/\s/g, "-").toLowerCase();
            // the value is everything after the first ":"; some info lines have two parts
            // ("Web Server: Enabled: Level 1"), which are reported as "Enabled Level 1"
            var sensorValue = sensorArray.slice(1).map(function (part) {
                return part.trim();
            }).join(" ").trim();

            if (sensorName.indexOf("Temperature") >= 0) {
                sensorName = sensorName + " - C";
                sensorValue = sensorValue.slice(0, -1).trim();
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
    Promise.all([
        executeCommand(cmdTemperature),
        executeCommand(cmdInfo)
    ])
        .then(parseData)
        .then(function (touchScreenSensorTable) {
            D.success(touchScreenSensorTable);
        })
        .catch(checkSshError);
}
