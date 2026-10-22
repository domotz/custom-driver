/**
 * Domotz Custom Driver
 * Name: Shure Ceiling Microphone Monitor
 * Description: Monitors Shure ceiling array microphones via a raw Telnet command/response
 * protocol on the device's control port.
 *
 * Communication protocol: Telnet (default port 2202, configurable via the "port" parameter).
 * Commands are sent wrapped in "< >" delimiters (e.g. "< GET DEVICE_AUDIO_MUTE >") and responses
 * are parsed from the matching "< REP ... >" reply. Failed or empty responses are retried up to
 * MAX_RETRIES times with an exponentially increasing timeout.
 *
 * Creates Custom Driver Variables with:
 *   - Mute Status, Serial Number, Firmware Version
 *
 * Available actions:
 *   - Mute (custom_1), Unmute (custom_2), Toggle Mute/Unmute (custom_3)
 *
 * Tested devices: Shure Ceiling Array Microphone
 */

var varPort = D.getParameter('port') || 2202; // Default Shure telnet port
console.info("port:", varPort);

// Shure commands to retrieve information
var SHURE_COMMANDS = {
    MUTE_STATUS: "GET DEVICE_AUDIO_MUTE",
    SERIAL_NUMBER: "GET SERIAL_NUM",
    FIRMWARE_VERSION: "GET FW_VER",
    // DEVICE_ID: "GET DEVICE_ID",
    // LED_MUTED: "GET LED_COLOR_MUTED",
    // LED_UNMUTED: "GET LED_COLOR_UNMUTED"
};

// Telnet configuration
var telnetParams = {
    port: varPort,
    negotiationMandatory: true,
    timeout: 2000,  // Base timeout
    shellPrompt: '>',
    enterKey: '\r\n',
    echoLines: 0,
    stripShellPrompt: true,
    debug: true
};

var MAX_RETRIES = 4;
var BASE_TIMEOUT = 2000;

/**
 * @remote_procedure
 * @label Mute
 * @documentation Mute the microphone
 */
function custom_1(){
    muteOn()
        .then(function(){ D.success() })
        .catch(failure)
}

/**
 * @remote_procedure
 * @label Unmute
 * @documentation UnMute the microphone
 */
function custom_2(){
    unMuteOn()
        .then(function(){ D.success() })
        .catch(failure)
}

/**
 * @remote_procedure
 * @label Toggle Mute/Unmute
 * @documentation Toggle the microphone
 */
function custom_3(){
    toggleMute()
        .then(function(){ D.success() })
        .catch(failure)
}

/**
 * Sends a single command to the Shure microphone with retry logic
 * @param {string} command The command to send
 * @param {number} retryCount Current retry count
 * @param {number} currentTimeout Current timeout value
 * @returns {Promise<string>} The response from the device
 */
function sendShureCommandWithRetry(command, retryCount, currentTimeout) {
    retryCount = retryCount || 0;
    currentTimeout = currentTimeout || BASE_TIMEOUT;

    var d = D.q.defer();
    
    // Format command with < > brackets and proper line ending
    var formattedCmd = "< " + command + " >\r\n";
    
    console.log("Attempting command:", command, "Retry:", retryCount, "Timeout:", currentTimeout);
    
    var params = Object.assign({}, telnetParams, {
        command: formattedCmd,
        exitOnFirstResponse: true,
        timeout: currentTimeout
    });

    D.device.sendTelnetCommand(params, function(out, err) {
        if (err) {
            console.error("Error executing command:", command, "Retry:", retryCount, "Error:", err);
            handleRetry(command, retryCount, currentTimeout, d);
            return;
        }

        if (!out || !out.trim()) {
            console.warn("Empty response for command:", command, "Retry:", retryCount);
            handleRetry(command, retryCount, currentTimeout, d);
            return;
        }

        // Check if response contains the expected pattern
        var expectedPattern = new RegExp("< REP " + command.replace("GET ", "") + "\\s+([^>]+)>");
        if (!expectedPattern.test(out)) {
            console.warn("Invalid response format:", out, "Retry:", retryCount);
            handleRetry(command, retryCount, currentTimeout, d);
            return;
        }

        console.log("Success for command:", command, "Retry:", retryCount);
        d.resolve(out);
    });

    return d.promise;
}

/**
 * Handles retry logic for failed commands
 * @param {string} command The command to retry
 * @param {number} retryCount Current retry count
 * @param {number} currentTimeout Current timeout value
 * @param {Object} deferred The deferred object to resolve/reject
 */
function handleRetry(command, retryCount, currentTimeout, deferred) {
    if (retryCount >= MAX_RETRIES) {
        console.error("Max retries reached for command:", command);
        deferred.resolve(""); // Resolve with empty string to continue with other commands
        return;
    }

    // Double the timeout for the next retry
    var nextTimeout = currentTimeout * 2;
    console.log("Retrying command:", command, "Next timeout:", nextTimeout);

    // Add a small delay before retry
    D.q.delay(200)
        .then(function() {
            return sendShureCommandWithRetry(command, retryCount + 1, nextTimeout);
        })
        .then(function(response) {
            deferred.resolve(response);
        })
        .catch(function(err) {
            deferred.reject(err);
        });
}

/**
 * Parses the Shure response and extracts the value for a specific command
 * @param {string} responses Combined responses string
 * @param {string} commandIdentifier The command identifier to look for
 * @returns {string} The extracted value
 */
function parseShureResponse(responses, commandIdentifier) {
    var pattern = new RegExp("< REP " + commandIdentifier + "\\s+([^>]+)>");
    var matches = responses.match(pattern);
    
    if (matches && matches[1]) {
        return matches[1].trim().replace(/^\{|\}$/g, '').trim();
    }
    
    return "Unknown";
}

/**
 * Executes commands sequentially with retry logic
 * @param {Array} commands Array of command objects
 * @param {Array} results Accumulated results
 * @returns {Promise<Array>} Promise resolving to array of variables
 */
function executeCommandSequence(commands, results) {
    results = results || [];
    
    if (commands.length === 0) {
        return D.q.resolve(results);
    }

    var currentCmd = commands[0];
    var remainingCmds = commands.slice(1);

    return sendShureCommandWithRetry("GET " + currentCmd.command)
        .then(function(response) {
            results.push(D.createVariable(
                currentCmd.id,
                currentCmd.label,
                parseShureResponse(response, currentCmd.command)
            ));

            // Add a small delay before next command
            return D.q.delay(200);
        })
        .then(function() {
            return executeCommandSequence(remainingCmds, results);
        })
        .catch(function(err) {
            console.error("Error executing command", currentCmd.command, err);
            results.push(D.createVariable(
                currentCmd.id,
                currentCmd.label,
                "Error"
            ));
            // Continue with next command even after error
            return D.q.delay(200).then(function() {
                return executeCommandSequence(remainingCmds, results);
            });
        });
}

/**
 * Gets all required information from the Shure microphone
 * @returns {Promise<Array>} Array of device variables
 */
function getShureInfo() {
    var commandSequence = [
        {command: "DEVICE_AUDIO_MUTE", id: "Audio Mute", label: "Mute Status"},
        {command: "SERIAL_NUM", id: "Serial Number", label: "Serial Number"},
        {command: "FW_VER", id: "Firmware Version", label: "Firmware Version"}
        // {command: "DEVICE_ID", id: "Device ID", label: "Device ID"},
        // {command: "LED_COLOR_MUTED", id: "LED Muted Color", label: "LED Color when Muted"},
        // {command: "LED_COLOR_UNMUTED", id: "LED Unmuted Color", label: "LED Color when Unmuted"}
    ];

    return executeCommandSequence(commandSequence);
}

function failure(err) {
    console.error(err);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * @remote_procedure
 * @label Validate Association
 * @documentation This procedure validates the connection to the Shure ceiling microphone
 */
function validate() {
    return sendShureCommandWithRetry("GET DEVICE_AUDIO_MUTE")
        .then(function(response) {
            if (response.includes("REP DEVICE_AUDIO_MUTE")) {
                D.success();
            } else {
                D.failure(D.errorType.PARSING_ERROR);
            }
        })
        .catch(function(err) {
            console.error(err);
            D.failure(D.errorType.GENERIC_ERROR);
        });
}

/**
 * @remote_procedure
 * @label Get Device Variables
 * @documentation This procedure retrieves the Shure microphone status and configuration
 */
function get_status() {
    getShureInfo()
        .then(D.success)
        .catch(failure);
}

/**
 * Sends a SET command to the Shure microphone with retry logic
 * @param {string} command The command to send
 * @param {number} retryCount Current retry count
 * @param {number} currentTimeout Current timeout value
 * @returns {Promise<string>} The response from the device
 */
function sendShureSetCommand(command, retryCount, currentTimeout) {
    retryCount = retryCount || 0;
    currentTimeout = currentTimeout || BASE_TIMEOUT;

    var d = D.q.defer();
    
    console.log("Attempting SET command:", command, "Retry:", retryCount, "Timeout:", currentTimeout);
    
    // Format command with < > brackets and proper line ending
    var formattedCmd = "< " + command + " >\r\n";
    
    var params = Object.assign({}, telnetParams, {
        command: formattedCmd,
        exitOnFirstResponse: true,
        timeout: currentTimeout
    });

    D.device.sendTelnetCommand(params, function(out, err) {
        if (err) {
            console.error("Error executing SET command:", command, "Retry:", retryCount, "Error:", err);
            handleSetRetry(command, retryCount, currentTimeout, d);
            return;
        }

        // For SET commands, we might need to wait and verify the state changed
        if (!out || !out.trim()) {
            console.warn("Empty response for SET command:", command, "Retry:", retryCount);
            handleSetRetry(command, retryCount, currentTimeout, d);
            return;
        }

        // Accept any response that doesn't indicate an error
        if (out.includes("ERR") || out.includes("ERROR")) {
            console.error("Error response from device:", out);
            handleSetRetry(command, retryCount, currentTimeout, d);
            return;
        }

        console.log("Success for SET command:", command, "Response:", out);
        d.resolve(out);
    });

    return d.promise;
}

/**
 * Handles retry logic for failed SET commands
 * @param {string} command The command to retry
 * @param {number} retryCount Current retry count
 * @param {number} currentTimeout Current timeout value
 * @param {Object} deferred The deferred object to resolve/reject
 */
function handleSetRetry(command, retryCount, currentTimeout, deferred) {
    if (retryCount >= MAX_RETRIES) {
        console.error("Max retries reached for SET command:", command);
        deferred.reject(new Error("Max retries reached"));
        return;
    }

    // Double the timeout for the next retry
    var nextTimeout = currentTimeout * 2;
    console.log("Retrying SET command:", command, "Next timeout:", nextTimeout);

    // Add a delay before retry
    D.q.delay(500)  // Longer delay for SET commands
        .then(function() {
            return sendShureSetCommand(command, retryCount + 1, nextTimeout);
        })
        .then(function(response) {
            deferred.resolve(response);
        })
        .catch(function(err) {
            deferred.reject(err);
        });
}

/**
 * Mutes the microphone
 * @returns {Promise} Promise that resolves when mute is successful
 */
function muteOn() {
    return sendShureSetCommand("SET DEVICE_AUDIO_MUTE ON")
        .catch(function(err) {
            console.error("Failed to mute:", err);
            throw err;
        });
}

/**
 * Unmutes the microphone
 * @returns {Promise} Promise that resolves when unmute is successful
 */
function unMuteOn() {
    return sendShureSetCommand("SET DEVICE_AUDIO_MUTE OFF")
        .catch(function(err) {
            console.error("Failed to unmute:", err);
            throw err;
        });
}

/**
 * Toggles the microphone mute state
 * @returns {Promise} Promise that resolves when toggle is successful
 */
function toggleMute() {
    return sendShureSetCommand("SET DEVICE_AUDIO_MUTE TOGGLE")
        .catch(function(err) {
            console.error("Failed to toggle mute:", err);
            throw err;
        });
}