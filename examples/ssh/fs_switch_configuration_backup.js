/**
 * Custom Integration for FS Switch
 * Description: This Configuration Management Script extracts the FS Switch configuration and backs it up
 *
 * Communication protocol is SSH
 *
 * Tested on FS Switch Version 2.2.0D
 *
 * Automates configuration backup for FS switch using SSH commands.
 * Handles authentication, retrieves the running configuration, and creates a backup.
 */

const commands = [
    "enable",                  // Enter privileged mode
    "terminal width 256",      // Set terminal width
    "terminal length 0",       // Disable pagination
    "show running-config"      // Retrieve the configuration
];

const sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    inter_command_timeout_ms: 500,
    global_timeout_ms: 60000,
    prompt: "#",
    commands: commands
};

/**
 * Handles SSH errors appropriately for Domotz.
 */
function handleSshError(error) {
    console.error("SSH error:", error.message);
    if (error.code === 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (error.code === 255 || error.code === 1) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Handles the callback for validating SSH command execution.
 */
function validateCallback (output, error) {
    if (error) {
        handleSshError(error);
    }
    console.info("Validation successful.");
    D.success();
}

/**
 * Extracts the "Current configuration" section from raw command output.
 */
function extractConfiguration(output) {
    if (!Array.isArray(output)) {
        console.error("Unexpected output format. Expected an array.");
        D.failure(D.errorType.GENERIC_ERROR);
    }
    const combined = output.join("\n");
    const configStartIndex = combined.indexOf("Current configuration:");
    if (configStartIndex === -1) {
        console.error("Could not find the start of the configuration.");
        D.failure(D.errorType.GENERIC_ERROR);
    }
    const promptPattern = /[\r\n](\S+#)\s*$/; // Matches the last line if it contains a prompt
    const promptMatch = combined.match(promptPattern);
    const configEndIndex = promptMatch ? promptMatch.index : combined.length;
    return combined.substring(configStartIndex, configEndIndex)
        .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, "") // Trim leading/trailing newlines
        .replace(/(\r?\n){2,}/g, "\n");
}

/**
 * Processes the output from an SSH command to create a backup configuration.
 */
function backupCallback(output, error) {
    if (error) {
        handleSshError(error);
    }
    const completeConfig = extractConfiguration(output);
    if (completeConfig) {
        D.success(
            D.createBackup({
                label: "FS Switch Configuration Backup",
                running: completeConfig
            })
        );
    } else {
        console.error("Failed to process configuration output.");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Validate function: Ensures authentication is successful and the device supports the necessary commands.
 */
function validate() {
    D.device.sendSSHCommands(sshOptions, validateCallback);
}

/**
 * @remote_procedure
 * @label Backup FS Switch Configuration
 * @documentation Retrieves and stores the configuration backup for the FS Switch.
 */
function backup() {
    D.device.sendSSHCommands(sshOptions, backupCallback);
}