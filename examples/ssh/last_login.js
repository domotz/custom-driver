var lastLoginUID = 'll-1';
var lastLoginLabel = 'Last Login';
var lastLoginUnit = 'text';

var COMMAND_VALIDATE = 'ls'
/**
 *  'grep' matches expressions 
 * in the '/var/log/auth.log' file:
 *'login' for a login at the console;
 *'accepted' for a successful SSH login;
 * option '-i' [i]gnores case;
 * option '-e' gives the [e]xpression
 * that follows;
 * '|' pipes the output
 * as input for the next command; 
 * 'tail' takes the last lines of input;
 * option '-n2' takes the last 
 * '2' [n]umber of lines, as the 
 * last line will be your current login;
 * '|' pipes once again;
 * 'head' takes the first lines of input;
 * option '-n1' takes the first '1' line 
 * (the last login before your current one);
*/
var COMMAND_GET_STATUS = 'grep -i -e login -e accepted /var/log/auth.log | grep -v "grep" | tail -n2 | head -n1';

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
    console.info(output)
    if (error){
        checkForPasswordError(error)
    };
    var lines = output.split('\n');
    var lastLoginValue = null;

    var lastLoginRegex = new RegExp('.*sshd\\[[\\d]+\\]:(.*) port.*');
    lines.forEach(function (line) {
        var match = line.match(lastLoginRegex);
        if (match){
            lastLoginValue = match[1];
        }
    });

    if (!lastLoginValue){
        console.error("Could not parse variable in output", output)
        D.failure(D.errorType.GENERIC_ERROR)
    } else {
        var lastLoginVariable = D.device.createVariable(
            lastLoginUID, lastLoginLabel, lastLoginValue, lastLoginUnit
        );
        // D.success accepts an Array of variable objects
        D.success([lastLoginVariable]);
    }
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
* the last user string and store it in a custom driver variable
*/
function get_status(){
    console.info("Getting last login ... ");
    sshCommandOptions['command'] = COMMAND_GET_STATUS;
    D.device.sendSSHCommand(
        sshCommandOptions, resultCallback
    );
}