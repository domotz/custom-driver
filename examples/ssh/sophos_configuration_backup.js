/**
 * Name: Sophos Firewall - Backup configuration
 * Description: This Configuration Management Script Extracts the Sophos Firewall configuration and backs it up
 *
 * Communication protocol is ssh
 *
 * Tested on Sophos Firmware Version 20.0.2
 *
 * Creates a configuration backup
 *
 **/

let sshOptions = {
    username: D.device.username(),
    password: D.device.password(),
    inter_command_timeout_ms: 1000,
    global_timeout_ms: 120000,
    prompt: ">",
};

const backupCommands = [
    {"keyConfig": "General Info", "command": "4"},
    {"keyConfig": "advanced-firewall", "command": "show advanced-firewall"},
    {"keyConfig": "date", "command": "show date"},
    {"keyConfig": "http_proxy", "command": "show http_proxy"},
    {"keyConfig": "lanbypass", "command": "show lanbypass"},
    {"keyConfig": "nat-policy application-server failover mail-notification", "command": "show nat-policy application-server failover mail-notification"},
    {"keyConfig": "port-affinity", "command": "show port-affinity"},
    {"keyConfig": "report-disk-usage watermark", "command": "show report-disk-usage watermark"},
    {"keyConfig": "service-param", "command": "show service-param"},
    {"keyConfig": "arp-flux", "command": "show arp-flux"},
    {"keyConfig": "dns", "command": "show dns"},
    {"keyConfig": "ips-settings", "command": "show ips-settings"},
    {"keyConfig": "license_status", "command": "show license_status"},
    {"keyConfig": "network interface-link PortA", "command": "show network interface-link PortA"},
    {"keyConfig": "network interface-link PortB", "command": "show network interface-link PortB"},
    {"keyConfig": "network interfaces", "command": "show network interfaces"},
    {"keyConfig": "network macaddr PortA", "command": "show network macaddr PortA"},
    {"keyConfig": "network macaddr PortB", "command": "show network macaddr PortB"},
    {"keyConfig": "network mtu-mss PortA", "command": "show network mtu-mss PortA"},
    {"keyConfig": "network mtu-mss PortB", "command": "show network mtu-mss PortB"},
    {"keyConfig": "network static-route", "command": "show network static-route"},
    {"keyConfig": "network static-route6", "command": "show network static-route6"},
    {"keyConfig": "pppoe connection status", "command": "show pppoe connection status"},
    {"keyConfig": "routing dgd-probe-delay", "command": "show routing dgd-probe-delay"},
    {"keyConfig": "routing multicast-group-limit", "command": "show routing multicast-group-limit"},
    {"keyConfig": "routing reroute-connection", "command": "show routing reroute-connection"},
    {"keyConfig": "routing sd-wan-policy-route reply-packet", "command": "show routing sd-wan-policy-route reply-packet"},
    {"keyConfig": "routing sd-wan-policy-route system-generate-traffic", "command": "show routing sd-wan-policy-route system-generate-traffic"},
    {"keyConfig": "routing wan-load-balancing", "command": "show routing wan-load-balancing"},
    {"keyConfig": "routing multicast-decrement-ttl", "command": "show routing multicast-decrement-ttl"},
    {"keyConfig": "routing policy-based-ipsec-vpn", "command": "show routing policy-based-ipsec-vpn"},
    {"keyConfig": "routing reroute-snat-connection", "command": "show routing reroute-snat-connection"},
    {"keyConfig": "routing source-base-route-for-alias", "command": "show routing source-base-route-for-alias"},
    {"keyConfig": "support_access", "command": "show support_access"},
    {"keyConfig": "country-host list", "command": "show country-host list"},
    {"keyConfig": "fqdn-host", "command": "show fqdn-host"},
    {"keyConfig": "ips_conf", "command": "show ips_conf"},
    {"keyConfig": "on-box-reports", "command": "show on-box-reports"},
    {"keyConfig": "proxy-arp", "command": "show proxy-arp"},
    {"keyConfig": "scanengine", "command": "show scanengine"},
    {"keyConfig": "vpn configuration", "command": "show vpn configuration"},
    {"keyConfig": "vpn connection status", "command": "show vpn connection status"}
];

let sshCommandsOutput= {}

/**
 * Handles SSH command errors by logging messages and categorizing the error.
 * @param {Error} err  The error object returned from an SSH command.
 */
function checkSshError(err) {
    if (err.message) console.error(err.message);
    if (err.code === 5) D.failure(D.errorType.AUTHENTICATION_ERROR);
    if (err.code === 255 || err.code === 1) D.failure(D.errorType.RESOURCE_UNAVAILABLE);
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * Extracts command strings from the `backupCommands` array.
 * @returns {string[]}  An array of command strings extracted from `backupCommands`.
 */
function extractCommandStringsFromBackupCommands() {
    return backupCommands.map(function (cmd) { return cmd.command; })
}

/**
 * Generates a formatted string of backup command results.
 * @returns {string}  A string representation of the backup commands and their outputs.
 */
function sortResult() {
    let backUpStringResult = "";
    for (let i = 0; i < backupCommands.length; i++) {
        backUpStringResult +=i + " - " + backupCommands[i].keyConfig + ": \n" + sshCommandsOutput[backupCommands[i].command].join("\n") + "\n"
    }
    return backUpStringResult.trim()
}

/**
 * Processes and cleans a string item from SSH command output.
 * @param {string} item  The raw string output from an SSH command.
 * @returns {string[]}  An array of processed strings, split by line breaks.
 */
function processItem(item) {
    return JSON.stringify(item)
        .replace('\\u001b[H\\u001b[', '')
        .replace(/\\t/g, '')
        .replace(/\\b/g, '')
        .replace(/console> /g, '')
        .replace(/"/g, '')
        .split('\\r\\n');
}

/**
 * Executes a series of SSH commands and returns a promise with the results.
 * @param {Object[]} command An array of command objects to be executed.
 * @returns {Promise<Object[]>}  A promise that resolves with the SSH command outputs or rejects with an error.
 */
function executeCommand(command) {
    const d = D.q.defer();
    sshOptions.commands = command
    D.device.sendSSHCommands(sshOptions, function (outputs, err) {
        if (err) {
            checkSshError(err);
            d.reject(err);
        } else {
            outputs.map(function (item) {
                let parts = processItem(item);
                let command = parts.shift();
                if (command) {
                    command = command.trim();
                    sshCommandsOutput[command] = parts;
                }
            });
            d.resolve(outputs);
        }
    });
    return d.promise;
}

/**
 * @remote_procedure
 * @label Validate Association for Backup
 * @documentation This procedure is used to validate if the device is correctly associated and performs the backup process
 */
function validate(){
    executeCommand(extractCommandStringsFromBackupCommands())
        .then(function () {
            D.success()
        })
        .catch(function (err) {
            checkSshError(err);
        });
}

/**
 * @remote_procedure
 * @label Backup Device Configuration
 * @documentation Backup the Edge OS device configuration
 */
function backup() {
    executeCommand(extractCommandStringsFromBackupCommands())
        .then(function () {
            D.success(
                D.createBackup(
                    {
                        label: "Device Configuration",
                        running: sortResult()
                    }
                )
            )
        })
        .catch(function (err) {
            checkSshError(err);
        });
}