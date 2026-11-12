// Simulated Ruckus ICX7150-C12 (FastIron 08.0.95) SSH session in the default SSH mode. Shape follows the
// FastIron CLI: each command output is the echoed command, its output and the next prompt
// ("ICX7150-C12#"); "show running-config" prints "Current configuration:" followed by the "!" separated
// configuration and "end"; the output stops at the prompt, with no newline after it. sendSSHCommands (not trimmed) returns one string per command.
// backup is covered in SSH mode only (PROTOCOL = "SSH" in the driver); the TFTP mode goes through
// D.tftpServer.accept, whose upload callback the fake D cannot drive.
const reply = require("../../replies");

const PROMPT = "ICX7150-C12#";
const RUNNING = `show running-config
Current configuration:
!
ver 08.0.95T213
!
stack unit 1
  module 1 icx7150-c12p-12-port-management-module
  module 2 icx7150-2-copper-port-2g-module
!
vlan 1 name DEFAULT-VLAN by port
!
vlan 10 name Users by port
 tagged ethe 1/1/11 to 1/1/12
 untagged ethe 1/1/1 to 1/1/8
!
hostname ICX7150-C12
ip dns server-address 9.9.9.9
!
username admin password .....
snmp-server community ..... ro
!
interface ethernet 1/1/1
 port-name Printer
!
end
${PROMPT}`;

const SSH_CMDS = ["enable", "show version"];
const BACKUP_CMDS = ["enable", "skip-page-display", "terminal length 0", "show running-config"];

const validateOut = [
    "enable\r\nICX7150-C12#\r\n",
    "show version\r\n  Copyright (c) Ruckus Networks\r\n  UNIT 1: compiled on Jan 10 2024 at 12:00:00 labeled as SPR08095\r\n  System: ICX7150-C12P, Boot-Monitor Version: 10.1.12\r\n  Uptime: 12 days 4 hours\r\n" + PROMPT + "\r\n"
];
const backupOut = [
    "enable\r\n" + PROMPT + "\r\n",
    "skip-page-display\r\n" + PROMPT + "\r\n",
    "terminal length 0\r\n" + PROMPT + "\r\n",
    RUNNING.replace(/\n/g, "\r\n")
];

module.exports = {
    cases: [{
        name: "ICX7150-C12, SSH mode",
        entryPoints: {
            validate: { calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: SSH_CMDS.join("\n"), reply: reply.sshCommands(validateOut) }] },
            backup: { calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: BACKUP_CMDS.join("\n"), reply: reply.sshCommands(backupOut) }] }
        }
    }]
};
