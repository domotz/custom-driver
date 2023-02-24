/**
 * Domotz Custom Driver 
 * Name: Control4 Zigbee Devices
 * Description: Collects data for control4 zigbee devices such as status, zap information etc 
 * 
 * Communication protocol is SSH. Utilizing the native windows powershell command
 * 
 * Tested on Control4 Version:
 *      - 2.9.0.528365
 * 
 * Creates Custom Driver "Zigbee Devices" Table with the following columns:
 *   - LID
 *   - SID
 *   - Status
 *   - Version
 *   - Product
 *   - Last Contact
 *   - RBoot
 *   - Node Type
 *   - Best Zap
 */
var columnHeaders = [
    {"label": "SID"},
    {"label": "Status"},
    {"label": "Version"},
    {"label": "Product"},
    {"label": "Last Contact"},
    {"label": "RBoot"},
    {"label": "Node Type"},
    {"label": "Best Zap"}
];
var zigbeeTable = D.createTable(
    "Zigbee Devices", 
    columnHeaders
);
/**
 * @remote_procedure
 * @label Validate Control4 Controller
 * @documentation Checks if the device is a Control4 controller and its zigbee server is running
 */
function validate(){
    var validateOptions = {
        timeout: 5000,
        command: "zman <<'EOT'\nhelp\nexit\nEOT\n"
    }
    function validatecallback(output, error){
        if (responseIsOk(output, error)){
            D.success();
        };
    };
    D.device.sendSSHCommand(validateOptions, validatecallback)
    
};
/**
 * @remote_procedure
 * @label Get Zigbee Devices Information
 * @documentation This procedure retrieves zigbee devices information via the control4 controller and inserts it in the monitoring table.
 */
function get_status(){
    function parseNodesCallback(output, error){
        responseIsOk(output, error);
        lines = output.split(/\r?\n/);

        var zigbeeNodesRegexp = /([\w\d]+)\s+([\w\d]+)\s+(\w+)\s+([\d\.]+)\s+([\w\d\_\:\-]+)\s+(\w{3}\s\w{3}\s[0-9]+\s[0-9\:]+)\s+(\d+)\s+([\w\s]+)\s+(0x[\w\d]+)/
        var matchOffset = 2;
        // Start from index 1 to skip table headers and emove last 2 lines to skip footers of the response
        for (var i = 1; i < lines.length - 2; i++) {
            var zigbeeEntry = lines[i].match(zigbeeNodesRegexp);
            if (zigbeeEntry){
                zigbeeTable.insertRecord(zigbeeEntry[1], zigbeeEntry.slice(matchOffset, columnHeaders.length + matchOffset))
            }
        }
        D.success(zigbeeTable)
    }
    // SSH Send Commands options
    var sshSendOptions = {
        command: "zman <<'EOT'\nshownodes\nexit\nEOT\n",
        timeout: 10000
    };
    D.device.sendSSHCommand(sshSendOptions, parseNodesCallback)
};

// Check for SSH Errors in the communication with the control4 device the driver is applied on
function responseIsOk(out, err) {
    var zmanErrorRegexp = /((zman: not found)|(unable to connect to zserver))/;
    if (err){
        console.error("Error message:" + err.message);
        if (err.code == 5) {
            D.failure(D.errorType.AUTHENTICATION_ERROR)
        } else if (err.code == 255){
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        } else {
            D.failure(D.errorType.GENERIC_ERROR);
        }
    } else if (!out || out.match(zmanErrorRegexp)) {
        console.error("Unable to retrieve data" + out);
        D.failure(D.errorType.RESOURCE_UNAVAILABLE)
    } else {
        return true;
    }
}