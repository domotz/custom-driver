// Simulated DrayTek Vigor2960 (firmware 1.0.9) SSH session. Shape follows `uci export <package>` (OpenWrt UCI export
// format: "package <name>", then "config '<type>' '<name>'" blocks with tab indented "option 'key' 'value'" lines) as the
// driver's header describes. The device prompt is "Vigor2960#"; sendSSHCommands (not trimmed) returns one string per
// command: echoed command, output, prompt. The vpn package is empty on this unit (the driver skips it).
const reply = require("../../replies");

const PROMPT = "Vigor2960#";
const COMMANDS = ["enable", "uci export system", "uci export network", "uci export firewall", "uci export vpn"];

const SYSTEM = [
    "package system",
    "",
    "config system 'main'",
    "\toption hostname 'Vigor2960'",
    "\toption timezone 'CET-1CEST,M3.5.0,M10.5.0/3'",
    "",
    "config check_cfg_upgrade 'cfg_ver'",
    "\toption version '1'"
];
const NETWORK = [
    "package network",
    "",
    "config interface 'lan1'",
    "\toption proto 'static'",
    "\toption ipaddr '192.168.1.1'",
    "\toption netmask '255.255.255.0'",
    "",
    "config interface 'wan1'",
    "\toption proto 'dhcp'"
];
const FIREWALL = [
    "package firewall",
    "",
    "config rule 'rule1'",
    "\toption name 'Block-Telnet'",
    "\toption src 'wan'",
    "\toption dest_port '23'",
    "\toption target 'DROP'"
];

const out = (cmd, lines) => cmd + "\r\n" + (lines.length ? lines.join("\r\n") + "\r\n" : "") + PROMPT;
const outputs = [
    "enable\r\n" + PROMPT,
    out("uci export system", SYSTEM),
    out("uci export network", NETWORK),
    out("uci export firewall", FIREWALL),
    out("uci export vpn", [])
];

module.exports = {
    cases: [{
        name: "vigor2960 1.0.9",
        entryPoints: {
            validate: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: "enable", reply: reply.sshCommands([outputs[0]]) }]
            },
            backup: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: COMMANDS.join("\n"), reply: reply.sshCommands(outputs) }]
            }
        }
    }]
};
