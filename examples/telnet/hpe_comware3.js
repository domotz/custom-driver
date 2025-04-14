/**
 * Custom Integration for 3Com/HPE Comware 3 Switch
 * Description: This Configuration Management Script extracts the 3Com/HPE Comware 3 Switch configuration and backs it up
 *
 * Communication protocol is Telnet
 *
 * Tested on 3Com Switch 5500-EI Software Version 3Com OS V3.03.02s168ep2
 *
 * Automates configuration backup for 3Com/HPE Comware 3 switch using Telnet commands.
 * Handles authentication, retrieves the running configuration, and creates a backup.
 */
var TelnetOptions = {
    timeout: 5000,
    negotiationMandatory: true,
    shellPrompt: ">",
    loginPrompt: "Username:",
    passwordPrompt: "Password:",
    username: D.device.username() + "\r",
    password: D.device.password() + "\r",
};

/**
 * Handles Telnet errors appropriately for Domotz.
 */
function handleTelnetError(error) {
    console.error("Telnet error:", error.message);
    if (error.code === 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (error.code === 255 || error.code === 1) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Handles the callback for validating Telnet command execution.
 */
function validateCallback (output, error) {
    if (error) {
        handleTelnetError(error);
    }
    console.info("Validation successful.");
    D.success();
}


/**
 * Extracts the "Current configuration" section from raw command output.
 */
function extractConfiguration(output) {
    const configStartIndex = output.indexOf("sysname");
    if (configStartIndex === -1) {
        console.error("Could not find the start of the configuration.");
        D.failure(D.errorType.GENERIC_ERROR);
    }
    const promptPattern = /[\r\n](\S+#)\s*$/; // Matches the last line if it contains a prompt
    const promptMatch = output.match(promptPattern);
    const configEndIndex = promptMatch ? promptMatch.index : output.length;
    return output.substring(configStartIndex, configEndIndex)
        .replace(/^\s*[\r\n]+|[\r\n]+\s*$/g, "") // Trim leading/trailing newlines
        .replace(/(\r?\n){2,}/g, "\n")
        .replace(/(?<=  ---- More ----).*?(42D)/g, "") // Trim first ESC character
        .replace(/(  ---- More ----).*?(42D)/g, ""); // Trim ---- More ---- and the second ESC character
        
}

/**
 * Processes the output from an Telnet command to create a backup configuration.
 */
function backupCallback(output, error) {
    if (error) {
        handleTelnetError(error);
    }
    const completeConfig = extractConfiguration(output);
    if (completeConfig) {
        D.success(
            D.createBackup({
                label: "HPE Comware Backup",
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
    TelnetOptions.command = "dis cur";
    D.device.sendTelnetCommand(TelnetOptions, validateCallback);
}
/**
 * @remote_procedure
 * @label Backup HPE Comware Configuration
 * @documentation Retrieves and stores the configuration backup for the HPE Comware Switch.
 */
function backup(){
    TelnetOptions.command = "dis cur";
    D.device.sendTelnetCommand(TelnetOptions, backupCallback);
}