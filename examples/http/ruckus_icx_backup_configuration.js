/**
 * ========================================
 * Ruckus ICX7150-C12 — Configuration Backup (SSH + TFTP)
 * Version: 1.0.0
 * ========================================
 * - validate(): verifies SSH access
 * - backup(): captures running-config via SSH or TFTP
 * ========================================
 * To switch to TFTP mode, change PROTOCOL below to 'TFTP'.
 * ========================================
 */

/* ------------ Protocol selection ------------ */

/*
 * Set to 'TFTP' to use TFTP mode instead of SSH.
 * SSH is the default and recommended method.
 */
var PROTOCOL = 'SSH';

/* ------------ SSH helpers (SSH version — unchanged) ------------ */

/* Build SSH options object (required format for this agent) */
function buildSshOptions(cmds) {
    return {
        username: D.device.username(),
        password: D.device.password(),
        inter_command_timeout_ms: 1000,
        global_timeout_ms: 15000,
        prompt: "#",
        commands: cmds
    };
}

/* Run SSH with proper options object */
function runSSH(commands, cb) {
    try {
        if (!commands || !D._.isArray(commands)) {
            console.error("Invalid SSH command list");
            cb(null, { code: -1, message: "Invalid command list" });
            return;
        }
        var opts = buildSshOptions(commands);
        console.debug("SSH command count: " + opts.commands.length);
        D.device.sendSSHCommands(opts, function (out, err) {
            if (err) {
                console.error("SSH error: " + JSON.stringify(err));
                cb(null, err);
                return;
            }
            console.debug("SSH raw output: " + JSON.stringify(out));
            cb(out, null);
        });
    } catch (ex) {
        console.error("SSH wrapper exception: " + ex);
        cb(null, { code: -2, message: "SSH wrapper exception" });
    }
}

/* Map SSH agent error into Domotz failure */
function sshFailure(err, fallbackMsg) {
    var msg = fallbackMsg || "SSH error";
    if (!err) {
        D.failure(D.errorType.GENERIC_ERROR, msg);
        return;
    }
    if (err === D.errorType.AUTHENTICATION_ERROR) {
        D.failure(D.errorType.AUTHENTICATION_ERROR, "Authentication failed");
        return;
    }
    if (err === D.errorType.TIMEOUT_ERROR) {
        D.failure(D.errorType.TIMEOUT_ERROR, "SSH timeout");
        return;
    }
    if (typeof err.code === "number") {
        if (err.code === 5) {
            D.failure(D.errorType.AUTHENTICATION_ERROR, "Authentication failed");
            return;
        }
        if (err.code === 2) {
            D.failure(D.errorType.TIMEOUT_ERROR, "SSH timeout");
            return;
        }
        if (err.code === 1 || err.code === 255) {
            D.failure(D.errorType.RESOURCE_UNAVAILABLE, "SSH resource unavailable");
            return;
        }
    }
    D.failure(D.errorType.GENERIC_ERROR, msg + ": " + (err.message || err));
}

/* Safe wrapper for config backup creation */
function makeBackup(obj) {
    try {
        if (typeof D.createBackup === "function") return D.createBackup(obj);
    } catch (e) {}
    return obj;
}

/* ------------ TFTP helpers (TFTP version — const→var, rest unchanged) ------------ */

var TFTP_FILENAME = Date.now() + '_ruckus_config.cfg';

var sshOptionsTftp = {
    username: D.device.username(),
    password: D.device.password(),
    prompt: '#',
    timeout: 30000,
    inter_command_timeout_ms: 2000
};

function handleSshErrorTftp(error) {
    console.error("SSH error:", error ? error.message : 'Unknown error');
    if (error && error.code === 5) {
        D.failure(D.errorType.AUTHENTICATION_ERROR);
    } else {
        D.failure(D.errorType.GENERIC_ERROR);
    }
}

function startBackup() {
    var serverOptions = {
        port: 69,
        filePath: TFTP_FILENAME,
        timeout: 30000
    };

    function onReady(error, host, port) {
        if (error) {
            console.error("TFTP server failed:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }

        console.info('TFTP server ready on %s. Sending copy command...', host);

        var tftpCommands = [
            'copy running-config tftp ' + host + ' ' + TFTP_FILENAME
        ];

        sshOptionsTftp.commands = tftpCommands;
        D.device.sendSSHCommands(sshOptionsTftp, function (output, error) {
            if (error) {
                handleSshErrorTftp(error);
            } else {
                console.info("SSH Command sequence sent. Waiting for file transfer...");
            }
        });
    }

    function onUpload(error, content) {
        if (error) {
            console.error("File transfer error:", error);
            D.failure(D.errorType.GENERIC_ERROR);
            return;
        }

        if (content && content.length > 0) {
            console.info('Backup received: %d bytes', content.length);
            var backup = D.createBackup({
                label: "Ruckus Running Config",
                running: content
            });
            D.success(backup);
        } else {
            console.error("Backup failed: Received empty content.");
            D.failure(D.errorType.GENERIC_ERROR);
        }
    }

    D.tftpServer.accept(serverOptions, onReady, onUpload);
}

/* ------------ Remote Procedures ------------ */

/**
 * @remote_procedure
 * @label Validate
 * @documentation Verifies SSH connectivity and privilege on the Ruckus ICX7150-C12.
 *               For TFTP mode, verifies SSH reachability used to trigger the transfer.
 */
function validate() {
    var protocol = PROTOCOL;

    if (protocol === 'TFTP') {
        sshOptionsTftp.commands = ['show stack'];
        D.device.sendSSHCommands(sshOptionsTftp, function (output, error) {
            if (error) {
                handleSshErrorTftp(error);
            } else {
                D.success();
            }
        });
        return;
    }

    // SSH (default)
    try {
        runSSH(["enable", "show version"], function (out, err) {
            if (err) {
                sshFailure(err, "Validation failed");
                return;
            }
            if (!out || !out.length) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE, "Empty SSH response");
                return;
            }
            D.success();
        });
    } catch (e) {
        console.error("validate() exception: " + e);
        D.failure(D.errorType.GENERIC_ERROR, "Unexpected exception during validate");
    }
}

/**
 * @remote_procedure
 * @label Backup Configuration
 * @documentation Connects via SSH, runs "enable", disables paging, captures running-config,
 * strips command echo and prompt, and returns a clean backup (SSH mode).
 * In TFTP mode, triggers the device to push running-config to the Domotz Agent via TFTP.
 */
function backup() {
    var protocol = PROTOCOL;

    if (protocol === 'TFTP') {
        startBackup();
        return;
    }

    // SSH (default)
    try {
        var cmds = [
            "enable",
            "skip-page-display",
            "terminal length 0",
            "show running-config"
        ];

        runSSH(cmds, function (out, err) {
            if (err) {
                sshFailure(err, "Backup failed");
                return;
            }
            if (!out || !out.length) {
                D.failure(D.errorType.RESOURCE_UNAVAILABLE, "No output from device");
                return;
            }

            var raw = String(out[out.length - 1] || "");
            console.debug("Raw config length: " + raw.length);

            if (!raw || raw.length < 10) {
                D.failure(D.errorType.PARSING_ERROR, "Empty or invalid config");
                return;
            }

            // Remove first and last line (command echo + prompt)
            var lines = raw.split(/\r?\n/);
            if (lines.length >= 3) {
                lines = lines.slice(1, -1); // drop line 0 and last line
            }
            var cleaned = lines.join("\n");
            console.debug("Cleaned config length: " + cleaned.length);

            var configuration = makeBackup({
                label: "Ruckus ICX7150-C12 — Running Config",
                running: cleaned
            });

            D.success(configuration);
        });
    } catch (e) {
        console.error("backup() exception: " + e);
        D.failure(D.errorType.GENERIC_ERROR, "Unexpected exception during backup");
    }
}
