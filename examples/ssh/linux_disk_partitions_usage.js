/** 
 * Name: Linux Disk Partitions Usage (df)
 * Description: Display information about disk partitions on a Linux system 
 * 
 * Communication protocol is SSH
 * 
 * Tested on Linux: Ubuntu 22.04.3 LTS"
 * 
 * Creates a Custom Driver Table with the following columns:
 *   - Mountpoint: The mount point of the disk partition.
 *   - Percentage Used: The percentage of disk space used on the partition.
 *   - Type: The filesystem type of the partition.
 *   - Size: The total size of the partition.
 *   - Available: The total amount of available space on the partition.
 * 
**/

// Command to retrieve disk partition information
var command = "df -Th";

// Set up the SSH command options
var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 5000
};

// Custom Driver Table to store disk partition information
var table = D.createTable(
    "Disk Partitions Usage",
    [
        { label: "Mountpoint" },
        { label: "Percentage Used", unit: "%" },
        { label: "Type" },
        { label: "Size" },
        { label: "Available" }
    ]
);

// Handle SSH errors
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255 || err.code == 1) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

// Execute SSH command and return a promise
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (out, err) {
        if (err) {
            checkSshError(err);
            d.reject(err);
        } else {
            d.resolve(out);
        }
    });
    return d.promise;
}

// Function to validate the output of the executed command
function parseValidateOutput(output) {
    if (output.trim() !== "") {
        console.log("Validation successful");
    } else {
        console.log("Validation failed: Unexpected output");
    }
}

// Parse and insert disk partition data into the table
function parseData(output) {
    var lines = output.trim().split("\n");
    lines.shift();
    lines.forEach(function (line) {
        var values = line.trim().split(/\s+/);
        var mountedOn = values[6];
        var usePercentage = values[5].replace(/[^\d,.]/g, "");
        var type = values[1];
        var size = values[2];
        var available = values[4];
        var recordId = values[0] + mountedOn;

        table.insertRecord(recordId, [mountedOn, usePercentage, type, size, available]);
    });
    
    D.success(table);
}

/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the device can respond correctly to the command
*/
function validate() {
    console.info("Verifying device can respond correctly to command ... ");
    executeCommand(command)
        .then(parseValidateOutput)
        .then(D.success)
        .catch(checkSshError);
}

/**
* @remote_procedure
* @label Get Disk Partitions Information
* @documentation Retrieves and parses information about disk partitions on a Linux system
*/
function get_status() {
    executeCommand(command)
        .then(parseData)
        .catch(checkSshError);
}       