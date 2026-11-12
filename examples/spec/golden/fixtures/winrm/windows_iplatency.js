// Simulated Windows 11 replies (English locale). Shape follows the documented output of `ping -n 2 <ip>`: the
// "Pinging ..." banner, a Reply line per packet, "Ping statistics" with "Packets: Sent = 2, Received = 2, Lost = 0
// (0% loss)," and, when any reply came back, "Approximate round trip times in milli-seconds:" with
// Minimum/Maximum/Average. A host that never answers has 100% loss and no round trip line. The WinRM mode wraps the
// command in `powershell -Command`; the SSH mode sends it as is. validate runs `ping /?` (the usage text).
const reply = require("../../replies");

const IPS = ["192.168.1.1", "192.168.1.50", "192.168.1.99"];
const ssh = (command) => command;
const wrap = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';

const HELP = [
    "",
    "Usage: ping [-t] [-a] [-n count] [-l size] [-f] [-i TTL] [-v TOS]",
    "            [-r count] [-s count] [[-j host-list] | [-k host-list]]",
    "            [-w timeout] [-R] [-S srcaddr] [-c compartment] [-p]",
    "            [-4] [-6] target_name",
    "",
    "Options:",
    "    -t             Ping the specified host until stopped.",
    "                   To see statistics and continue - type Control-Break;",
    "                   To stop - type Control-C.",
    ""
].join("\r\n");

const PING = {
    "192.168.1.1": [
        "",
        "Pinging 192.168.1.1 with 32 bytes of data:",
        "Reply from 192.168.1.1: bytes=32 time=2ms TTL=64",
        "Reply from 192.168.1.1: bytes=32 time=4ms TTL=64",
        "",
        "Ping statistics for 192.168.1.1:",
        "    Packets: Sent = 2, Received = 2, Lost = 0 (0% loss),",
        "Approximate round trip times in milli-seconds:",
        "    Minimum = 2ms, Maximum = 4ms, Average = 3ms",
        ""
    ].join("\r\n"),
    "192.168.1.50": [
        "",
        "Pinging 192.168.1.50 with 32 bytes of data:",
        "Reply from 192.168.1.50: bytes=32 time=21ms TTL=128",
        "Request timed out.",
        "",
        "Ping statistics for 192.168.1.50:",
        "    Packets: Sent = 2, Received = 1, Lost = 1 (50% loss),",
        "Approximate round trip times in milli-seconds:",
        "    Minimum = 21ms, Maximum = 21ms, Average = 21ms",
        ""
    ].join("\r\n")
};
// A host that does not answer at all: no reply lines, no round trip times.
PING["192.168.1.99"] = [
    "",
    "Pinging 192.168.1.99 with 32 bytes of data:",
    "Request timed out.",
    "Request timed out.",
    "",
    "Ping statistics for 192.168.1.99:",
    "    Packets: Sent = 2, Received = 0, Lost = 2 (100% loss),",
    ""
].join("\r\n");

function calls(kind, method, wrapCommand, send) {
    return [{ kind, method, target: wrapCommand("ping -n 2 192.168.1.1"), reply: send(PING["192.168.1.1"]) },
        { kind, method, target: wrapCommand("ping -n 2 192.168.1.50"), reply: send(PING["192.168.1.50"]) },
        { kind, method, target: wrapCommand("ping -n 2 192.168.1.99"), reply: send(PING["192.168.1.99"]) }];
}
const validateCall = (kind, method, wrapCommand, send) => [{ kind, method, target: wrapCommand("ping /?"), reply: send(HELP) }];

module.exports = {
    cases: [{
        name: "winrm, three hosts",
        parameters: { protocol: "winrm", ipAddressesToCheck: IPS },
        entryPoints: {
            validate: { calls: validateCall("winrm", "sendWinRMCommand", wrap, reply.winrm) },
            get_status: { calls: calls("winrm", "sendWinRMCommand", wrap, reply.winrm) }
        }
    }, {
        name: "ssh, three hosts",
        parameters: { protocol: "ssh", ipAddressesToCheck: IPS },
        entryPoints: {
            validate: { calls: validateCall("ssh", "sendSSHCommand", ssh, reply.ssh) },
            get_status: { calls: calls("ssh", "sendSSHCommand", ssh, reply.ssh) }
        }
    }]
};
