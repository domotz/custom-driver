// Simulated Huawei S5731 (VRP V200R022C00SPC500) SSH session. Shape follows the VRP CLI: user view prompt
// "<Huawei-SW1>", "display authentication-scheme" prints a table of scheme names and methods ("RADIUS", "Local"),
// "display stp" prints the "-------[CIST Global Info][Mode MSTP]-------" block. sendSSHCommands (not trimmed)
// returns one string per command: echoed command, output, next prompt with no newline after it.
const reply = require("../../replies");

const PROMPT = "<Huawei-SW1>";
const COMMANDS = ["display authentication-scheme", "display stp"];
const LINE = "-------------------------------------------------------------------------------";

const AUTH = [
    "display authentication-scheme",
    LINE,
    "Authentication-scheme-name         Authentication-method",
    LINE,
    "default                            Local",
    "radius_scheme                      RADIUS",
    LINE,
    "Total  2,  2 printed",
    PROMPT
].join("\r\n");

const STP = [
    "display stp",
    "-------[CIST Global Info][Mode MSTP]-------",
    "CIST Bridge         :32768.4c1f-cc12-3456",
    "Config Times        :Hello 2s MaxAge 20s FwDly 15s MaxHop 20",
    "Active Times        :Hello 2s MaxAge 20s FwDly 15s MaxHop 20",
    "CIST Root/ERPC      :32768.4c1f-cc12-3456 / 0",
    "CIST RegRoot/IRPC   :32768.4c1f-cc12-3456 / 0",
    "CIST RootPortId     :0.0",
    "BPDU-Protection     :Disabled",
    "TC or TCN received  :12",
    "TC count per hello  :0",
    "STP Converge Mode   :Normal",
    "Time since last TC  :0 days 3h:12m:44s",
    "Number of TC        :5",
    "Last TC occurred    :GigabitEthernet0/0/1",
    PROMPT
].join("\r\n");

const call = () => ({ kind: "sshCommands", method: "sendSSHCommands", target: COMMANDS.join("\n"), reply: reply.sshCommands([AUTH, STP]) });

module.exports = {
    cases: [{
        name: "S5731 V200R022 RADIUS scheme and MSTP",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
