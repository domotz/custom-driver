// Simulated Control4 controller (OS 2.9.0) `zman` session fed through a heredoc. Shape is a best reconstruction from the
// driver's regular expression (LID, SID, status, version, product, "Www Mmm dd hh:mm" last contact, RBoot, node type, best
// zap as 0xNN), Control4 does not publish a verbatim sample. The driver skips the first line (header) and the last two
// lines (a node count and the closing banner). One node is offline.
const reply = require("../../replies");

const HELP = [
    "Zigbee Manager (zman)",
    "Commands:",
    "  help       show this help",
    "  shownodes  list the nodes of the network",
    "  exit       quit",
    ""
].join("\n");

const NODES = [
    "LID  SID   Status   Version  Product         Last Contact      RBoot  Node Type        Best Zap",
    "1    0004  online   1.32     C4-ZIGBEE-LD    Tue Oct 14 09:12  10     Router           0x5a",
    "2    0007  offline  1.28     C4-KD120        Mon Oct 13 22:47  4      End Device       0x3c",
    "3    00a1  online   2.04     C4-DIM-WW       Tue Oct 14 09:11  7      Router           0x61",
    "Total nodes: 3",
    "exit"
].join("\n");

module.exports = {
    cases: [{
        name: "control4 2.9.0",
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "zman <<'EOT'\nhelp\nexit\nEOT\n", reply: reply.ssh(HELP) }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: "zman <<'EOT'\nshownodes\nexit\nEOT\n", reply: reply.ssh(NODES) }] }
        }
    }]
};
