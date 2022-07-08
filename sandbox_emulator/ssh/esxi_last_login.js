/**
 * This Driver Extracts the Last Login line for an ESXI device.
 * Communication protocol is SSH.
 * Creates a single custom driver variables with label "Last Login" containging the following information:
 *   - The user name that logged in
 *   - The IP Address from which the ssh session was initiated
 */

var lastLoginUID = "ll-1";
var lastLoginLabel = "Last Login";
var lastLoginUnit = "line";

/**
 * The SSH Command Options
 * @property {string} [prompt]  - The SSH prompt must be set if different than # 
 * @property {int}    [timeout] - The command wait time in miliseconds.
*/
var sshCommandOptions = {
    "prompt": "]",
    "timeout": 5000
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
    }
}

/**
 * Excuting a simple command to test access to device:
 * 'ls' lists directory contents
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    var commandValidate = "ls";
    console.info("Verifying credentials ... ", commandValidate);
    sshCommandOptions["command"] = commandValidate;
    function loginCallback(output, error) {
        variables = [];
        if (error) {
            checkForPasswordError(error);
        } else {
            D.success();
        }
    }
    D.device.sendSSHCommand(
        sshCommandOptions, loginCallback
    );
}

/**
* @remote_procedure
* @label Get Device Variables
* @documentation This procedure is used to collect 
* the last user string and store it in a custom driver variable
*/
function get_status() {
    console.info("Getting last login ... ");
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
    var commandLastLogin = "grep -i -e login -e accepted /var/log/auth.log | grep -v \"grep\" | tail -n2 | head -n1";
    sshCommandOptions["command"] = commandLastLogin;
    /**
     * Helper callback function to create the Variables for the device
     * Calls D.success to indicate successful run and setting variable values
    */
    function resultCallback(output, error) {
        if (error) {
            checkForPasswordError(error);
        }
        var lines = output.split("\n");
        var lastLoginValue = null;

        var lastLoginRegex = new RegExp(".*sshd\\[[\\d]+\\]:(.*) port.*");
        lines.forEach(function (line) {
            var match = line.match(lastLoginRegex);
            if (match) {
                lastLoginValue = match[1];
            }
        });
        if (!lastLoginValue) {
            console.error("Could not parse variable in output", output);
            D.failure(D.errorType.PARSING_ERROR);
        } else {
            var lastLoginVariable = D.device.createVariable(
                lastLoginUID, lastLoginLabel, lastLoginValue, lastLoginUnit
            );
            // D.success accepts an Array of variable objects
            D.success([lastLoginVariable]);
        }
    }
    D.device.sendSSHCommand(
        sshCommandOptions, resultCallback
    );
}