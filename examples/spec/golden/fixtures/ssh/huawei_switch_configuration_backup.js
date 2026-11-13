// Simulated Huawei S-series switch (VRP V200R022C00SPC500) SSH session. Shape follows the VRP CLI:
// user view prompt "<Huawei-SW1>", "screen-length 0 temporary" answers "Info: The configuration takes effect
// on the current user terminal interface only.", "display current-configuration" prints the configuration as
// "!Software Version ..." / "#" separated blocks ending with "return". sendSSHCommands (not trimmed)
// returns one string per command: echoed command, output, and the next prompt with no newline after it.
const reply = require("../../replies");

const PROMPT = "<Huawei-SW1>";
const FIRST = ["screen-length 0 temporary"];
const SECOND = ["screen-length 0 temporary", "display current-configuration"];

const INFO = "Info: The configuration takes effect on the current user terminal interface only.";
const screenOut = (prefix) => prefix + "\r\n" + INFO + "\r\n" + PROMPT;

const CONFIG = [
    "!Software Version V200R022C00SPC500",
    "#",
    "sysname Huawei-SW1",
    "#",
    "vlan batch 10 20 100",
    "#",
    "interface Vlanif100",
    " ip address 192.168.100.2 255.255.255.0",
    "#",
    "interface GigabitEthernet0/0/1",
    " port link-type access",
    " port default vlan 10",
    "#",
    "aaa",
    " local-user admin password irreversible-cipher $1c$abcdefg$",
    "#",
    "return"
];

const display = "display current-configuration\r\n" + CONFIG.join("\r\n") + "\r\n" + PROMPT;

module.exports = {
    cases: [{
        name: "S5735 V200R022",
        entryPoints: {
            validate: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: FIRST.join("\n"), reply: reply.sshCommands([screenOut("screen-length 0 temporary")]) }]
            },
            backup: {
                calls: [
                    { kind: "sshCommands", method: "sendSSHCommands", target: FIRST.join("\n"), reply: reply.sshCommands([screenOut("screen-length 0 temporary")]) },
                    { kind: "sshCommands", method: "sendSSHCommands", target: SECOND.join("\n"), reply: reply.sshCommands([screenOut("screen-length 0 temporary"), display]) }
                ]
            }
        }
    }]
};
