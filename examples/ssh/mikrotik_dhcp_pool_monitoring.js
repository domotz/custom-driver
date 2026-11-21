/**
 * Name: MikroTik DHCP Pool Monitoring 
 * Description: This script monitors DHCP address pools on a MikroTik device
 *             
 * Communication protocol is SSH.
 * 
 * Tested under MikroTik RouterOS RB5009UG+S+
 * 
 * Creates a Custom Driver table with the following columns:
 *    - Name: Name of the DHCP pool
 *    - Start IP Address: Start IP address of the DHCP pool
 *    - End IP Address: End IP address of the DHCP pool
 *    - Used: Number of IP addresses used in the pool
 *    - Free: Number of free IP addresses in the pool
 *    - Total: Total number of IP addresses in the pool
 * 
 */

var dhcpPoolInfo = "/ip/pool/print without-paging"; // Command to retrieve DHCP pool information
var dhcpPoolUsedIps = "/ip/pool/used/print without-paging"; // Command to retrieve used DHCP IPs

// Custom Driver table to store DHCP pool information
var table = D.createTable(
    "DHCP addresses pools",
    [
        { label: "Start IP Address", valueType: D.valueType.STRING },
        { label: "End IP Address", valueType: D.valueType.STRING },
        { label: "Used", valueType: D.valueType.NUMBER },
        { label: "Free", valueType: D.valueType.NUMBER },
        { label: "Total", valueType: D.valueType.NUMBER }
    ]
);

var sshConfig = {
    username: D.device.username(),
    password: D.device.password(),
    timeout: 5000
};

//Handle SSH errors
function checkSshError(err) {
    if(err.message) console.error(err.message);
    if(err.code == 5){
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code == 255 || err.code == 1) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        console.error(err);
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

// Execute SSH command and return a promise
function executeCommand(command) {
    var d = D.q.defer();
    sshConfig.command = command;
    D.device.sendSSHCommand(sshConfig, function (output, error) {
        if (error) {
            checkSshError(error);
        } else {           
            d.resolve(output);      
        }
    });
    return d.promise;
}

function executePoolCommands(){
    return D.q.all([
        executeCommand(dhcpPoolInfo),
        executeCommand(dhcpPoolUsedIps)
    ]);
}

// Function to sanitize the record ID 
function sanitize(output){
    var recordIdReservedWords = ['\\?', '\\*', '\\%', 'table', 'column', 'history'];
    var recordIdSanitisationRegex = new RegExp(recordIdReservedWords.join('|'), 'g');
    return output.replace(recordIdSanitisationRegex, '').slice(0, 50).replace(/\s+/g, '-').toLowerCase();
}

// Parses the output of the SSH commands and populates the custom table
function parseData(output) {
    var poolInfo = output[0].split("\r\n").slice(2);
    var usedIps = output[1].split("\r\n").slice(2);
    
    poolInfo.forEach(function(lines) {
        var parts = lines.trim().split(/\s+/);
        var name = parts[1];
        var range = parts[2];
        var usedIp = 0;

        usedIps.forEach(function(lines) {

            var used = lines.trim().split(/\s+/);
            if (used[0] == name) {
                usedIp++;
            }
        });

        var rangeParts = range.split('-');
        var startIP = rangeParts[0];
        var endIP = rangeParts[1];
        var start = ipToNumber(startIP);
        var end = ipToNumber(endIP);
        var totalIp = end - start + 1;
        var freeIp = totalIp - usedIp;
        var recordId = sanitize(name);
        table.insertRecord(recordId, [
            startIP,
            endIP,
            usedIp,
            freeIp,
            totalIp
        ]);
    });
    D.success(table);
}

// Convert IP address to a number
function ipToNumber(ip) {
    var parts = ip.split('.');
    return((parts[0] * Math.pow(256, 3))  + (parts[1] * Math.pow(256, 2)) + (parts[2] * Math.pow(256, 1)) + (parts[3] * Math.pow(256,0)));
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure validates if the driver can be applied to a device during association and validates provided credentials.
 */
function validate() {
    executePoolCommands()
        .then(parseValidateOutput)
        .then(D.success)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

function parseValidateOutput(output) {
    for (var i = 0; i < output.length; i++) {
        if (!output[i]) {
            console.error("Validation unsuccessful");
            return D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        } 
    }
    console.log("Validation successful");
    D.success();
   
}

/**
 * @remote_procedure
 * @label Get MikroTik DHCP Pool  
 * @documentation This procedure retrieves information about MikroTik DHCP pools, such as IP range, used IPs and free IPs.
 */
function get_status() {
    executePoolCommands()
        .then(parseData)
        .catch(function (err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}