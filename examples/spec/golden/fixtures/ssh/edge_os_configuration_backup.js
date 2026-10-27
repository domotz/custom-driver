// Simulated Ubiquiti EdgeRouter (EdgeOS 2.0.9, Vyatta based) SSH session. Shape follows the EdgeOS CLI: after
// `exec /bin/vbash` the shell prompt is "ubnt@EdgeRouter:~$", `show configuration` prints the hierarchical
// "section { ... }" config. sendSSHCommands (not trimmed) returns one string per command: echoed command, output, prompt.
// The driver opens a session first to learn the prompt (commands ["exec /bin/vbash"]), then runs the real session.
const reply = require("../../replies");

const PROMPT = "ubnt@EdgeRouter:~$";

const CONFIG = [
    "firewall {",
    "    all-ping enable",
    "    name WAN_IN {",
    "        default-action drop",
    "    }",
    "}",
    "interfaces {",
    "    ethernet eth0 {",
    "        address dhcp",
    "        description WAN",
    "    }",
    "    ethernet eth1 {",
    "        address 192.168.1.1/24",
    "    }",
    "}",
    "service {",
    "    ssh {",
    "        port 22",
    "        protocol-version v2",
    "    }",
    "}",
    "system {",
    "    host-name EdgeRouter",
    "    login {",
    "        user ubnt {",
    "            level admin",
    "        }",
    "    }",
    "}"
];

const PROMPT_CALL = {
    kind: "sshCommands", method: "sendSSHCommands", target: "exec /bin/vbash",
    reply: reply.sshCommands(["exec /bin/vbash\r\n" + PROMPT + " "])
};

const session = (command, output) => ({
    kind: "sshCommands", method: "sendSSHCommands", target: "exec /bin/vbash\n" + command,
    reply: reply.sshCommands(["exec /bin/vbash\r\n" + PROMPT + " ", command + "\r\n" + output + "\r\n" + PROMPT + " "])
});

module.exports = {
    cases: [{
        name: "edgerouter 2.0.9",
        entryPoints: {
            validate: {
                calls: [
                    PROMPT_CALL,
                    session("show configuration ?", "Possible completions:\r\n  all     Show all configuration\r\n  commands Show configuration as commands\r\n  show configuration all commands")
                ]
            },
            backup: {
                calls: [
                    PROMPT_CALL,
                    session("terminal length 0 && show configuration", CONFIG.join("\r\n"))
                ]
            }
        }
    }]
};
