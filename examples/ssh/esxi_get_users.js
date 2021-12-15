var userUID = 'user-';
var userLabel = 'User - ';
var userUnit = ' ';

/**
 * The SSH Command Options
 * @property {string} [prompt]  - The SSH prompt must be set if different than # 
 * @property {int}    [timeout] - The command wait time in miliseconds.
*/
var sshCommandOptions = {
    'prompt': ']',
    'timeout': 5000
};

/**
 * verifies ssh command did not result in a password error
 * Calls D.failure in case the authentication with the device failed (error code 5)
*/
function checkForPasswordError(error) {
    console.error("Received an error during execution", error);
    if (error.code === 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    };
};

/**
 * Excuting a simple command to test access to device:
 * 'ls' lists directory contents
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    var commandValidate = 'ls';
    console.info("Verifying credentials ... ", commandValidate);
    function loginCallback(output, error) {
        variables = [];
        if (error) {
            checkForPasswordError(error);
        } else {
            D.success();
        };
    };
    sshCommandOptions['command'] = commandValidate;
    D.device.sendSSHCommand(
        sshCommandOptions, loginCallback
    );
};

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used to collect 
* the users in the system and store them as custom driver variables
*/
function get_status() {
    console.info("Getting Users ... ");
    /**
     * command to get users
     * 'cut' cuts out a section 
     * from the '/etc/passwd' file; 
     * option '-d:' sets the [d]elimiter 
     *  as ':' - the separator in our file; 
     *  option '-f1' takes only [f]ield '1' 
     *  (the one containing the username);
    */
    var commandGetOSUsers = 'cut -d: -f1 /etc/passwd';
    sshCommandOptions['command'] = commandGetOSUsers;
    /**
     * Helper callback function to create the Variables for the device
     * Calls D.success to indicate successful run and setting variable values
    */
    function resultCallback(output, error) {
        variables = [];
        if (error) {
            checkForPasswordError(error);
        };
        var lines = output.split('\n');
        var uidIndex = 1
        lines.forEach(function (line) {
            var userVariable = D.device.createVariable(
                userUID + uidIndex, userLabel + uidIndex, line, userUnit
            );
            variables.push(userVariable);
            uidIndex += 1;
        });
        D.success(variables);
    };
    D.device.sendSSHCommand(
        sshCommandOptions, resultCallback
    );
};