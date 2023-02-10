/**
 * Domotz Custom Driver 
 * Name: Crestron Touch Screen Monitoring 
 * Description: This drivers monitors all info sensors and temperature sensors and add a reboot button to the driver page.
 * 
 * Communication protocol is SSH.
 * 
 * Creates a Custom Driver Table with the following colums:
 *  - Sensor
 *  - Value
**/
// Define the commands to be run over SSH
var cmdTemperature='temperature'
var cmdInfo='info'
var cmdReboot='reboot'

// Define the SSH options when running the commands
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    port: 22,
    timeout: 30000
};

// Create the table definition
var table = D.createTable(
            "Touchscreen Sensors",
            [
                { label: "Sensor" },
                { label: "Value" }
            ]
        );

// SSH promise definition
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if(err.code == 255) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

function sshPromise(command){
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
   sshPromise(cmdReboot).then(function(){
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
    sshPromise(cmdTemperature).then(function(){
        D.success();
    });
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    D.q.all([
        // run the promises sequentially
        sshPromise(cmdTemperature),
        sshPromise(cmdInfo)
    ]).then(function(result){
        // result is an array
        // cmdTemperature output is result[0]
        // cmdInfo output is result[1]
        // concatenating the results into one output
        output = result[0]+result[1];
        // processing the output
        var outputArr = output.split(/\r?\n/);
        if (outputArr == null) {
            console.error("outputArr is empty or undefined")
            D.failure(D.errorType.GENERIC_ERROR) 
        }
        var outputArrLen = outputArr.length;
        for (var i = 0; i < outputArrLen-1; i++) {
            // removing whitespaces
            var fields = outputArr[i].replace(/\s+/g,' ').trim();
            // removing prompts characters before ">"
            var fields = fields.substring(fields.indexOf(">")+1);

            if (fields == "") {
                console.info("line empty, skipping")
            }
            else {
                //splitting fields using ":" as separator
                var fieldsArr = fields.split(":");

                if (fieldsArr[0] == null) {
                    console.error("fieldsArray[0] is empty  or undefined")
                    D.failure(D.errorType.GENERIC_ERROR) 
                }
                //creating the id field for the table by concat "id-" with the first element of the array
                var recordId='id-'+fieldsArr[0].replace(/\s/g, '-').toLowerCase();
                var lastElement = fieldsArr[fieldsArr.length - 1];

                if (fieldsArr[0].includes("Temperature")) {
                    var lastElement = fieldsArr[fieldsArr.length - 1].slice(0, -1);
                }

                table.insertRecord(
                    recordId, [fieldsArr[0], lastElement]
                )

            }   
        }
        return table;
    }).then(function(table){
        D.success(table);
    });
}
