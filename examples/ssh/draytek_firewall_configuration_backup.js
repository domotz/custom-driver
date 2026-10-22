/**
 * Name: DrayTek Firewall Configuration Backup
 * Description: Retrieves the running configuration from a DrayTek firewall
 *              over SSH using the device's built-in `uci export` command, and backs it up as
 *              plain text. No TFTP transfer required.
 * 
 *
 * Communication protocol: SSH
 *
 * Verified on a Vigor2960 (Hardware 1.0, Firmware 1.0.9). UCI_PACKAGES below is the exact list
 * of config packages this firmware exposes (taken from its own `uci export system` output,
 * under `config 'check_cfg_upgrade' 'cfg_ver'`). A package that doesn't apply on a given unit
 * (e.g. no VPN configured) just comes back empty and is skipped, not treated as an error.
 * On a different DrayTek model/firmware, re-check that list via a manual SSH session first.
 *
 * Required permissions: admin account with SSH access enabled
 *   (System Maintenance > Management > Access Control > enable "SSH").
 */

const UCI_PACKAGES = ['system', 'network', 'firewall', 'vpn'];

// Match the device's full prompt, not a bare '#' - some config values (e.g. modem dial
// strings) legitimately end in '#'. global_timeout_ms (not `timeout`) is the real option
// name for the overall SSH session budget - raised here since the 'network' export is large.
const DEVICE_PROMPT = 'Vigor2960#';
const GLOBAL_TIMEOUT_MS = 90000;
const INTER_COMMAND_TIMEOUT_MS = 5000;

const baseSshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    prompt: DEVICE_PROMPT,
    inter_command_timeout_ms: INTER_COMMAND_TIMEOUT_MS,
    global_timeout_ms: GLOBAL_TIMEOUT_MS
};

function handleSshError(error) {
    console.error("SSH error:", error ? error.message : 'Unknown error');
    if (error && error.code === 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else if (error && (error.code === 255 || error.code === 1)) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

/**
 * Each raw SSH output for a command looks like:
 *   "uci export <name>\r\n<...config text, or nothing at all...>\r\nVigor2960#"
 * Strip the echoed command line (first line) and the trailing prompt line (last line),
 * keeping only the actual uci export content in between.
 */
function extractSection(rawOutput) {
    if (!rawOutput) {
        return '';
    }
    const lines = rawOutput.split('\r\n');
    if (lines.length <= 2) {
        return '';
    }
    return lines.slice(1, lines.length - 1).join('\n').trim();
}

function backupCallback(output, error) {
    if (error) {
        handleSshError(error);
        return;
    }

    if (!Array.isArray(output) || output.length < UCI_PACKAGES.length + 1) {
        console.error("Unexpected SSH output format:", output);
        D.failure(D.errorType.GENERIC_ERROR);
        return;
    }

    // output[0] is the response to 'enable'; output[1..] map 1:1 to UCI_PACKAGES, in order.
    const sections = [];
    UCI_PACKAGES.forEach(function (name, i) {
        const content = extractSection(output[i + 1]);
        // Logged per-package so a partial/truncated capture is visible in the driver's
        // execution log rather than only showing up as "the backup looked a bit short".
        console.info("uci export " + name + ": " + content.length + " bytes");
        if (content) {
            sections.push(content);
        } else {
            console.info("uci package '" + name + "' returned no content (not present/empty on this device) - skipping.");
        }
    });

    if (sections.length === 0) {
        console.error("No configuration content was retrieved from any known uci package.");
        D.failure(D.errorType.GENERIC_ERROR);
        return;
    }

    const runningConfig = sections.join('\n\n');
    console.info("Total backup size: %d bytes", runningConfig.length);

    D.success(D.createBackup({
        label: "DrayTek Running Config Backup",
        running: runningConfig
    }));
}

function validate() {
    const options = Object.assign({}, baseSshOptions, { commands: ['enable'] });
    D.device.sendSSHCommands(options, function (output, error) {
        if (error) {
            handleSshError(error);
        } else {
            console.info("Validation successful.");
            D.success();
        }
    });
}

function backup() {
    console.info("Retrieving DrayTek configuration via 'uci export'...");
    const commands = ['enable'].concat(UCI_PACKAGES.map(function (name) {
        return 'uci export ' + name;
    }));
    const options = Object.assign({}, baseSshOptions, { commands: commands });
    D.device.sendSSHCommands(options, backupCallback);
}