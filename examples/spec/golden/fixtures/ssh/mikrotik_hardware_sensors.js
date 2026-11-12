// Simulated MikroTik CRS354-48P-4S+2Q+ (RouterOS 7.11) replies. Shape follows the documented `/system health print`
// table output of RouterOS 7 (https://help.mikrotik.com/docs/display/ROS/Health): a "Columns:" line, a
// "# NAME VALUE TYPE" header, one numbered row per sensor; state sensors (psu1-state) have no TYPE column.
const reply = require("../../replies");

const COMMAND = "system health print";

const HEALTH = [
    "Columns: NAME, VALUE, TYPE",
    "# NAME                 VALUE  TYPE",
    "0 psu1-voltage         24.1   V",
    "1 psu2-voltage         0      V",
    "2 poe-out-consumption  45.1   W",
    "3 switch-temperature   52     C",
    "4 board-temperature1   41     C",
    "5 board-temperature2   39     C",
    "6 cpu-temperature      48     C",
    "7 fan1-speed           5120   RPM",
    "8 psu1-state           ok",
    "9 psu2-state           fail",
    ""
].join("\r\n");

module.exports = {
    cases: [{
        name: "crs354, psu2 failed",
        entryPoints: {
            validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(HEALTH) }] },
            get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(HEALTH) }] }
        }
    }]
};
