//tcp.domotz.co:39781
//tcp.domotz.co:39843
var device = D.createExternalDevice("tcp.domotz.co");

function parseOutput(output) {
    console.debug(output);
    D.success();
}




/**
* @remote_procedure
* @label Validate Association
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    D.success();
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used for retrieving device * variables data
*/
function get_status() {
    D.device.sendWinRMCommand({
        "command": 'Get-winevent -Logname "Security" -Maxevents 1;',
        "username": D.device.username(),
        "password": D.device.password(),
        "port": 39843
    }, parseOutput);
}