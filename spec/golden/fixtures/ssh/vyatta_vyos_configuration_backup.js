// Simulated VyOS 1.4 SSH session. Shape follows the VyOS CLI: operational mode prompt "vyos@vyos:~$", and
// `show configuration json` prints the whole configuration as one compact JSON object (nodes as nested objects, values as
// strings). sendSSHCommands (not trimmed) returns one string per command: echoed command, output, next prompt with no newline.
const reply = require("../../replies");

const PROMPT = "vyos@vyos:~$ ";

const CONFIG = JSON.stringify({
    interfaces: {
        ethernet: {
            eth0: { address: "dhcp", "hw-id": "52:54:00:12:34:56" },
            eth1: { address: "192.168.10.1/24", description: "LAN", "hw-id": "52:54:00:12:34:57" }
        },
        loopback: { lo: {} }
    },
    nat: { source: { rule: { 100: { outbound_interface: "eth0", source: { address: "192.168.10.0/24" }, translation: { address: "masquerade" } } } } },
    service: { ssh: { port: "22" } },
    system: {
        "host-name": "vyos",
        login: { user: { vyos: { authentication: { "encrypted-password": "$6$rounds=656000$abc$XyZ", "plaintext-password": "" } } } },
        "name-server": ["1.1.1.1", "9.9.9.9"]
    }
});

module.exports = {
    cases: [{
        name: "vyos 1.4",
        entryPoints: {
            validate: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: "echo 'Connected'", reply: reply.sshCommands(["echo 'Connected'\r\nConnected\r\n" + PROMPT]) }]
            },
            backup: {
                calls: [{
                    kind: "sshCommands", method: "sendSSHCommands", target: "show configuration json | cat",
                    reply: reply.sshCommands(["show configuration json | cat\r\n" + CONFIG + "\r\n" + PROMPT])
                }]
            }
        }
    }]
};
