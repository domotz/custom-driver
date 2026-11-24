// Simulated Cisco IOS 15.2 Catalyst over SSH. validate opens the session with no command (sendSSHCommands with an
// empty command list); the sandbox answers one output string per command, so an empty list.
// backup: D.tftpServer.accept starts the collector's TFTP server (onReady gives its host and port), the driver
// sends `copy running-config tftp:` answering the host and file name prompts, IOS prints "<n> bytes copied" and
// the server's onUploadEnd delivers the uploaded running-config.
const reply = require("../../replies");

const RUNNING_CONFIG = [
    "!",
    "version 15.2",
    "service timestamps debug datetime msec",
    "hostname access-sw-01",
    "!",
    "interface GigabitEthernet0/1",
    " description uplink",
    " switchport mode trunk",
    "!",
    "end",
    ""
].join("\n");

const COPY_OUTPUT = "Address or name of remote host []? 192.168.1.2\r\nDestination filename [running-config]? \r\n!!\r\n"
    + RUNNING_CONFIG.length + " bytes copied in 0.312 secs (512 bytes/sec)\r\naccess-sw-01#";

module.exports = {
    cases: [{
        name: "Catalyst IOS 15.2",
        entryPoints: {
            validate: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: "", reply: reply.sshCommands([]) }]
            },
            backup: {
                calls: [
                    { kind: "tftp", method: "accept", reply: reply.tftpUpload(RUNNING_CONFIG, "192.168.1.2", 69) },
                    { kind: "sshCommands", method: "sendSSHCommands", target: /^copy running-config tftp:\r192\.168\.1\.2\r/, reply: reply.sshCommands([COPY_OUTPUT]) }
                ]
            }
        }
    }]
};
