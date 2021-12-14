var ntpUID = 'ntp-';
var ntpLabel = 'NTP Configuration - ';
var ntpUnit = 'line';

var COMMAND_VALIDATE = 'ls'

/**
 * 'cat' outputs ([cat]enates 
 *  to the standard output) 
 *  the '/etc/ntp.conf' file
*/
var COMMAND_GET_STATUS = 'cat /etc/ntp.conf';

/**
 * The SSH Command Options
 * @property {string} [prompt] - The SSH prompt must be set if different than # 
*/
var sshCommandOptions = {
    'prompt': ']'
};

/**
 * verifies ssh command did not result in a password error
 * Calls D.failure in case the authentication with the device failed (error code 5)
*/
function checkForPasswordError(error){
    console.error("Received an error during execution", error);
    if (error.code === 5){
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}
/**
 * Helper callback function to create the Variables for the device
 * Calls D.success to indicate successful run and setting variable values
*/
function resultCallback(output, error) {
    variables = []
    if (error){
        checkForPasswordError(error)
    };
    var lines = output.split('\n');
    var uidIndex = 1
    lines.forEach(function (line) {
        var ntpVariable = D.device.createVariable(
            ntpUID+uidIndex, ntpLabel+uidIndex, line, ntpUnit
        );
        uidIndex+=1;
        variables.push(ntpVariable);
    });
    D.success(variables)
};

/**
 * Excuting a simple command to test access to device:
 * 'ls' lists directory contents
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate(){
    console.info("Verifying credentials ... ", COMMAND_VALIDATE)
    sshCommandOptions['command'] = COMMAND_VALIDATE;
    D.device.sendSSHCommands(
        sshCommandOptions, resultCallback
    );
} 

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used to collect 
* the ntp configuration and store it in a custom driver variable
*/
function get_status(){
    console.info("Getting NTP Configuration ... ");
    sshCommandOptions['command'] = COMMAND_GET_STATUS;
    D.device.sendSSHCommand(
        sshCommandOptions, resultCallback
    );
}