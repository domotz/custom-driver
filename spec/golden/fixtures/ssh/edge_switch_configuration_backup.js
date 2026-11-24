// Simulated Ubiquiti EdgeSwitch 8 150W (firmware 1.9.x) SSH session. Shape follows the EdgeSwitch CLI (Broadcom FASTPATH,
// Cisco-like): privileged prompt "(UBNT EdgeSwitch) #", `show running-config` prints "Current Configuration:" and "!"
// separated blocks ending with "exit" sections. sendSSHCommands (not trimmed) returns one string per command:
// echoed command, output, next prompt with no newline.
const reply = require("../../replies");

const PROMPT = "(UBNT EdgeSwitch) #";

const CONFIG = [
    "!Current Configuration:",
    "!",
    "!System Description \"EdgeSwitch 8 150W, 1.9.2, Linux 3.6.5, 1.0.5.5008305\"",
    "!System Software Version \"1.9.2\"",
    "!",
    "network protocol none",
    "network parms 192.168.1.20 255.255.255.0 192.168.1.1",
    "vlan database",
    "vlan 10,20",
    "exit",
    "configure",
    "hostname \"EdgeSwitch-Office\"",
    "username \"admin\" password 5f4dcc3b5aa765d61d8327deb882cf99 level 15 encrypted",
    "interface 0/1",
    "switchport access vlan 10",
    "poe opmode auto",
    "exit",
    "exit"
];

const COMMANDS = ["terminal length 0", "show running-config"];
const outputs = [
    "terminal length 0\r\n" + PROMPT,
    "show running-config\r\n" + CONFIG.join("\r\n") + "\r\n" + PROMPT
];

// Note: the driver looks for "Current Configuration:" anywhere in the block.
module.exports = {
    cases: [{
        name: "edgeswitch 8 150w 1.9.2",
        entryPoints: {
            validate: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: "echo 'SSH OK'", reply: reply.sshCommands(["SSH OK\r\n" + PROMPT]) }]
            },
            backup: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: COMMANDS.join("\n"), reply: reply.sshCommands(outputs) }]
            }
        }
    }]
};
