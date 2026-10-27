// Simulated FS S3400-24T4FP (FSOS 2.2.0D) SSH session. Shape follows the Cisco-style FSOS CLI: privileged prompt
// "Switch#", "show running-config" prints "Current configuration:", "!" separated blocks and "end".
// sendSSHCommands (not trimmed) returns one string per command: echoed command, output, next prompt with no newline.
const reply = require("../../replies");

const COMMANDS = ["enable", "terminal width 256", "terminal length 0", "show running-config"];
const PROMPT = "FS-SW1#";

const CONFIG = [
    "Current configuration:",
    "!",
    "version 2.2.0D Build 112345",
    "!",
    "hostname FS-SW1",
    "!",
    "vlan database",
    " vlan 10,20,100",
    "!",
    "interface vlan 100",
    " ip address 192.168.100.2 255.255.255.0",
    "!",
    "interface ethernet 1/0/1",
    " switchport mode access",
    " switchport access vlan 10",
    "!",
    "username admin privilege 15 password 7 0a1b2c3d4e5f",
    "!",
    "end"
];

const outputs = [
    "enable\r\n" + PROMPT,
    "terminal width 256\r\n" + PROMPT,
    "terminal length 0\r\n" + PROMPT,
    "show running-config\r\n" + CONFIG.join("\r\n") + "\r\n" + PROMPT
];

const call = () => ({ kind: "sshCommands", method: "sendSSHCommands", target: COMMANDS.join("\n"), reply: reply.sshCommands(outputs) });

module.exports = {
    cases: [{
        name: "S3400-24T4FP FSOS 2.2.0D",
        entryPoints: {
            validate: { calls: [call()] },
            backup: { calls: [call()] }
        }
    }]
};
