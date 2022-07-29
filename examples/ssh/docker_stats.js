/**
 * This Driver Extracts the CPU and Memory % statistics for the running dockers on the host devices.
 * Communication protocol is SSH.
 * Creates a Custom Driver Table with the following columns:
 *   - Id
 *   - Mem %
 *   - CPU %
 */

// The ssh options for docker stats command execution
var options = {
    "command": "docker stats --no-stream --format \"table {{.Container}}\t{{.Name}}\t{{.CPUPerc}}\t{{.MemPerc}}\"",
    "username": D.device.username(),
    "password": D.device.password(),
    "timeout": 5000
};

// Helper function to parse the docker stats response and call the success callback
function successCallback(output) {
    // Creation of custom driver table 
    var table = D.createTable(
        "Docker List Memory and CPU",
        [
            { label: "Name" },
            { label: "CPU", unit: "%" },
            { label: "MEM", unit: "%" }
        ]
    );
    var lines = output.split("\n");
    // Check if the docker stats command response headers are there
    if (lines[0].indexOf("CONTAINER") === -1) {
        console.error("Output did not have the known command response first line. Received lines" + lines);
        D.failure(D.errorType.PARSING_ERROR);
    }
    var values = lines.slice(1);
    for (var index in values) {
        data = values[index].split(/(\s+)/);
        var uid = data[0];
        var name = data[2];
        var cpu = data[4].split("%")[0];
        var mem = data[6].split("%")[0];
        table.insertRecord(
            uid, [name, cpu, mem]
        );

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
* @documentation Creates Docker statistic custom driver table
*/
function get_status() {
    D.device.sendSSHCommand(options, commandExecutionCallback);
}
D.device.sendSSHCommand(, function (out, err) {
    
}