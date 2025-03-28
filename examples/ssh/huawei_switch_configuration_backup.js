/**
 * Huawei Switch Backup Configuration
 * Description: This Configuration Management Script extracts the Huawei Switch configuration and backs it up
 *
 * Communication protocol is SSH
 *
 * Tested on Huawei Switch version V200R022C00SPC500
 *
 * Automates configuration backup for Huawei switch using SSH commands.
 * Handles authentication, retrieves the running configuration, and creates a backup.
 *
 * Required permissions: Level 2 user
 *
 */


const sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    prompt: '>',
    inter_command_timeout_ms: '2000',
    timeout: '60000',
    commands: ['screen-length 0 temporary']
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
    const table = output[1].split('\r\n');
    return table.slice(1, table.length - 1).join('\n');
}

/**
 * Processes the output from an SSH command to create a backup configuration.
 */
function backupCallback(output, error) {
    if (error) {
        handleSshError(error);
    }
    const config = extractConfiguration(output);

    if (config) {
        D.success(
            D.createBackup({
                label: "Huawei Switch Configuration Backup",
                running: config
            })
        );
    } else {
        console.error("Failed to process configuration output.");
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Extracts the prompt from the output.
 * @param {Array} output - The SSH command output.
 * @returns {string} The extracted prompt from the output.
 */
function getPrompt(output) {
    return output[0].split('\r\n')[2];
}

/**
 * Updates SSH options with the provided prompt and adds a command to display the current configuration.
 * @param {string} prompt - The SSH prompt to be used.
 * @returns {void}
 */
function updateSshOptionsToDisplayConfig(prompt) {
    sshOptions.prompt = prompt
    sshOptions.commands.push('display current-configuration')
}

/**
 * Retrieves the configuration by handling errors, extracting the prompt, and sending SSH commands.
 * @param {Array} output - The SSH command output.
 * @param {string} error - Error message, if any.
 * @returns {void}
 */
function getConfig(output, error) {
    if (error) {
        handleSshError(error);
    }
    const prompt = getPrompt(output);
    updateSshOptionsToDisplayConfig(prompt);

    D.device.sendSSHCommands(sshOptions, backupCallback);
}

/**
 * Validate function: Ensures authentication is successful and the device supports the necessary commands.
 */
function validate() {
    D.device.sendSSHCommands(sshOptions, validateCallback);
}

/**
 * @remote_procedure
 * @label Backup Huawei Switch Configuration
 * @documentation Retrieves and stores the configuration backup for the Huawei Switch.
 */
function backup() {
    D.device.sendSSHCommands(sshOptions, getConfig);
}