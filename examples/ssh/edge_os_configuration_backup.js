/**
 * This Configuration Management Script Extracts the device configuration for Ubiquiti EdgeOS Devices (such as routers).
 * Communication protocol is SSH.
 * Creates a configuration backup.
 *
 * Required permissions: Level 2 user
 *
 */

const DEFAULT_PROMPT = '#'; // EdgeOS devices typically use '#' for root and '$' for non-root users
/**
 * @param {number} customPort
 * @label Custom SSH port
 * @description SSH port to connect to the EdgeOS Router (default: 22)
 * @type NUMBER
 */
var customPort = D.getParameter("customPort") || 22;

/**
* @remote_procedure
* @label Validate Association for Backup
* @documentation This procedure is used to validate if the device supports the needed commands for configuration backup
*/
function validate() {
    console.info("Verifying ... ");
    var validateCommand = "show configuration ?";
    function validateCallback(output, error){
        if (error){
            checkSshError(error);
        } else if (output && output.length === 2 && output[1].indexOf("show configuration all commands") != undefined) {
            D.success();
        } else {
            console.error("Unparsable output " + output)
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        }
    };
    executeCommand(validateCommand)
        .then(validateCallback)
        .catch(checkSshError);
};

/**
* @remote_procedure
* @label Backup Device Configuration
* @documentation Backup the Edge OS device configuration
*/
function backup() {
    var performBackupCommand = "terminal length 0 && show configuration";
    function performBackupCallback(output, error){
        if (error){
            checkSshError(error);
        } else if (output != null) {
            var lines = output[1].split('\n');
            // Remove the first and last lines
            lines.shift(); // Removes the first line
            lines.pop();   // Removes the last line
            // Join the remaining lines back into a single string
            var deviceConfiguration = lines.join('\n');
            D.success(
                D.createBackup(
                    {
                        label: "Device Configuration",
                        running: deviceConfiguration
                    }
                )
            );
        } else {
            console.error("Unparsable output" + output)
            D.failure(D.errorType.RESOURCE_UNAVAILABLE)
        }
    };
    executeCommand(performBackupCommand)
        .then(performBackupCallback)
        .catch(checkSshError);
}

var extractPromptSshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    inter_command_timeout_ms: 1000,
    global_timeout_ms: 2000,
    prompt: DEFAULT_PROMPT,
    port: customPort,
};

var sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    inter_command_timeout_ms: 1000,
    global_timeout_ms: 5000,
    prompt: DEFAULT_PROMPT,
    port: customPort
};
// Utility function that checks the type of error that has occured
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code == 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code == 255 || err.code == 1) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

function extractFullPrompt() {
    var d = D.q.defer();
    extractPromptSshOptions.commands = ['exec /bin/vbash'];
    D.device.sendSSHCommands(extractPromptSshOptions, function (out, err) {
        if (err) {
            checkSshError(err);
            d.reject(err);
        } else {
            if (out && out.length > 0) {
                // Extract the prompt from the output
                const fullPrompt = out[0].split('\n')[1].trim();
                console.info('Full prompt extracted: ' + fullPrompt);
                sshOptions.prompt = fullPrompt;
            } else {
                console.error('No output received to extract prompt.');
                D.failure(D.errorType.GENERIC_ERROR);
            }
            d.resolve(out);
        }
    });
    return d.promise;
}

// Utility function that changes the bash terminal and executes the command on the EdgeOS device
function executeCommand(command) {
    return extractFullPrompt()
    .then(function () {
        var d = D.q.defer();
        sshOptions.commands = ["exec /bin/vbash", command];
        D.device.sendSSHCommands(sshOptions, function (out, err) {
            if (err) {
                checkSshError(err);
                d.reject(err);
            } else {
                d.resolve(out);
            }
        });
        return d.promise;
    })
}