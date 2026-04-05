/**
 * Name: EdgeSwitch Configuration Backup (SSH)
 * Description: Pulls running config from EdgeSwitch using SSH only.
 * Requirements:
 * This integration requires the EdgeSwitch to land in 'enable' mode upon SSH login.
 * To achieve this, run the following command on the switch in Config mode:
 * 
 *     aaa authorization exec default local
 * 
 * Without this, the backup process may fail due to privilege limitations.
 */

/**
 * @param {number} customPort
 * @label Custom SSH port
 * @description SSH port to connect to the EdgeSwitch (default: 22)
 * @type NUMBER
 */
var customPort = D.getParameter("customPort") || 22;

var sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    port: customPort,
    inter_command_timeout_ms: 2000,
    global_timeout_ms: 30000,
    prompt: "#",
    exec_prompt: "#",
    pty: false,
    algorithms: {
        kex: [
            "diffie-hellman-group1-sha1",
            "diffie-hellman-group14-sha1"
        ],
        serverHostKey: [
            "ssh-rsa",
            "ssh-dss"
        ]
    }
};

/**
 * @remote_procedure
 * @label Validate SSH Support
 * @documentation Confirms SSH access.
 */
function validate() {
    console.info("Testing SSH login for EdgeSwitch...");

    sshOptions.commands = ["echo 'SSH OK'"];

    D.device.sendSSHCommands(sshOptions, function(out, err) {
        if (err) {
            console.error("SSH validation failed.");
            checkSshError(err);
        } else {
            console.info("SSH validated successfully.");
            D.success();
        }
    });
}

/**
 * @remote_procedure
 * @label Backup EdgeSwitch Config via SSH
 * @documentation Retrieves EdgeSwitch running config directly over SSH.
 */
function backup() {
    console.info("Initiating SSH-based configuration backup...");

    sshOptions.commands = ["terminal length 0", "show running-config"];

    D.device.sendSSHCommands(sshOptions, function(out, err) {
        if (err) {
            console.error("Failed to retrieve configuration via SSH.");
            checkSshError(err);
            return;
        }

        var config = parseRunningConfig(out);
        if (!config) {
            console.error("No valid configuration found in output.");
            D.failure(D.errorType.RESOURCE_UNAVAILABLE);
            return;
        }

        console.info("Configuration retrieved successfully.");
        D.success(D.createBackup({
            label: "EdgeSwitch Running Config (SSH)",
            running: config
        }));
    });
}

/**
 * Extracts the running config from SSH output blocks.
 * @param {Array} outputs
 * @returns {string|null}
 */
function parseRunningConfig(outputs) {
    var i;
    for (i = 0; i < outputs.length; i++) {
        var block = cleanOutput(outputs[i]);
        if (block && block.indexOf("Current Configuration:") !== -1) {
            return block;
        }
    }
    return null;
}

/**
 * Removes ANSI codes and unwanted output lines.
 * @param {string} raw
 * @returns {string}
 */
function cleanOutput(raw) {
    if (!raw) {
        return "";
    }
    return raw
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
        .replace(/--More--[\s\S]*?(?=\n)/g, "")
        .replace(/[\r\n]+/g, "\n")
        .trim();
}

/**
 * Maps SSH errors to Domotz error types and reports them.
 * @param {object} err
 */
function checkSshError(err) {
    if (!err) {
        D.failure(D.errorType.GENERIC_ERROR);
    } else if (err.code === 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (err.code === 255 || err.code === 1) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else if (err.message && err.message.toLowerCase().indexOf("timeout") !== -1) {
        D.failure(D.errorType.TIMEOUT);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}
