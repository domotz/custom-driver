/**
 * Name: VyOS Configuration Backup (Optimized JSON Mode)
 * Description: Extracts VyOS configuration in JSON format over SSH using user-defined port.
 */

/**
 * @param {number} portNumber
 * @label Custom Port
 * @description SSH port to communicate with VyOS (e.g. 22)
 * @type NUMBER
 */
var portNumber = D.getParameter("portNumber") || 22;

var sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    port: portNumber,
    inter_command_timeout_ms: 5000,
    global_timeout_ms: 60000,
    prompt: "$"
};

/**
* @remote_procedure
* @label Validate Association for Backup
* @documentation Validates SSH login only.
*/
function validate() {
    console.info("Validating SSH login only...");
    var d = D.q.defer();
    sshOptions.commands = ["echo 'Connected'"];
    D.device.sendSSHCommands(sshOptions, function(out, err) {
        if (err) {
            console.error("Validation failed with SSH error");
            checkSshError(err);
            d.reject(err);
        } else {
            console.info("SSH connection established.");
            D.success();
            d.resolve();
        }
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Backup Device Configuration
 * @documentation Backs up the VyOS configuration in JSON format.
 */
function backup() {
    var backupCommand = "show configuration json | cat";

    executeCommand(backupCommand)
        .then(function(outputArray) {
            var configText = extractJsonFromOutputs(outputArray);
            if (!configText) {
                console.error("Failed to extract valid configuration.");
                D.failure(D.errorType.RESOURCE_UNAVAILABLE);
                return;
            }
                try {
                    var parsedJson = JSON.parse(configText);
                    var formattedJson = JSON.stringify(parsedJson, null, 2); // 2-space indentation
                    D.success(D.createBackup({
                label: "VyOS Configuration (JSON)",
                running: formattedJson
                }));
                    } catch (e) {
                        console.error("Failed to parse JSON for formatting: " + e);
                        D.failure(D.errorType.GENERIC_ERROR);
                    }
        })
        .catch(checkSshError);
}

/**
 * Utility to parse SSH command outputs and find the valid JSON.
 * Iterates all outputs and finds the block with JSON-like structure.
 * @param {Array} outputArray - Output blocks from SSH command
 * @returns {string|null} Cleaned JSON string or null if not found
 */
function extractJsonFromOutputs(outputArray) {
    console.info("Scanning outputs for JSON...");
    for (var i = 0; i < outputArray.length; i++) {
        var cleaned = cleanOutput(outputArray[i]);
        var startIndex = cleaned.indexOf("{");
        var lastIndex = cleaned.lastIndexOf("}");
        if (startIndex !== -1 && lastIndex !== -1) {
            var jsonPart = cleaned.substring(startIndex, lastIndex + 1).trim();
            console.info("Extracted JSON from block " + i + ": " + jsonPart.substring(0, 100));
            return jsonPart;
        }
    }
    console.error("No valid JSON found in SSH output blocks.");
    return null;
}

/**
 * Cleans raw SSH output by removing ANSI codes and known junk.
 * @param {string} raw
 * @returns {string}
 */
function cleanOutput(raw) {
    if (!raw) {
        return "";
    }
    return raw.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/[\r\n]+/g, '\n').trim();
}

/**
 * Utility function to handle SSH errors in a standardized way.
 */
function checkSshError(err) {
    if (err && err.message) {
        console.error("SSH Error: " + err.message);
    }
    if (err && err.code == 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err && (err.code == 255 || err.code == 1)) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Utility function to execute SSH command.
 * @param {string} command - CLI command to execute.
 * @returns {Promise} - Resolves with output array.
 */
function executeCommand(command) {
    console.info("Executing command on VyOS device: " + command);
    var d = D.q.defer();
    sshOptions.commands = [command];
    D.device.sendSSHCommands(sshOptions, function(out, err) {
        if (err) {
            console.error("Error during SSH execution: " + JSON.stringify(err));
            checkSshError(err);
            d.reject(err);
        } else {
            console.info("Command execution successful");
            d.resolve(out);
        }
    });
    return d.promise;
}
