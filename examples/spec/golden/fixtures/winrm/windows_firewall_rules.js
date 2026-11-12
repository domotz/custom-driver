// Simulated Windows 11 / PowerShell 5.1 replies. Shape follows `Get-NetFirewallRule | Select-Object ... |
// ConvertTo-Json -Compress` (MSFT_NetFirewallRule): Name is the rule id (a GUID in braces for app rules), Group is
// null for rules outside a group, and the CIM enums are numbers in 5.1: Direction Inbound 1 / Outbound 2,
// Action NotConfigured 0 / Allow 2 / Block 4, Enabled True 1 / False 2. A single rule is a bare object.
// The SSH mode runs the same command through `powershell -Command`.
const reply = require("../../replies");

const COMMAND = 'Get-NetFirewallRule | Where-Object {$_.DisplayName -like "Skype" -or $_.DisplayName -like "AnyDesk"} | Select-Object Name, DisplayName, Group, Direction, Action, Enabled | ConvertTo-Json -Compress';
const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';

const VALIDATE_OUTPUT = [
    "",
    "Name                  : CoreNet-DHCP-In",
    "DisplayName           : Core Networking - Dynamic Host Configuration Protocol (DHCP-In)",
    "Description           : Allows DHCP (Dynamic Host Configuration Protocol) messages for stateful auto-configuration.",
    "DisplayGroup          : Core Networking",
    "Group                 : @FirewallAPI.dll,-25000",
    "Enabled               : True",
    "Profile               : Any",
    "Platform              : {}",
    "Direction             : Inbound",
    "Action                : Allow",
    "",
    ""
].join("\r\n");

const RULES = [
    { Name: "{6F2A9C1B-3D4E-4B7A-8C55-1E0D2A9B7F31}", DisplayName: "Skype", Group: null, Direction: 1, Action: 2, Enabled: 1 },
    { Name: "{0B7D52E4-91AF-4C0E-A3D8-5C6E7F8A9B10}", DisplayName: "AnyDesk", Group: null, Direction: 2, Action: 4, Enabled: 2 }
];

const compact = (value) => JSON.stringify(value) + "\r\n";
const PARAMS = { firewallFilter: ["Skype", "AnyDesk"] };

function winrm(name, data) {
    return {
        name,
        parameters: Object.assign({ protocol: "winrm" }, PARAMS),
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-NetFirewallRule", reply: reply.winrm(VALIDATE_OUTPUT) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(compact(data)) }] }
        }
    };
}

module.exports = {
    cases: [
        winrm("winrm, two rules", RULES),
        winrm("winrm, one rule is a bare object", RULES[0]),
        {
            name: "ssh, two rules",
            parameters: Object.assign({ protocol: "ssh" }, PARAMS),
            entryPoints: {
                validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: ssh("Get-NetFirewallRule"), reply: reply.ssh(VALIDATE_OUTPUT) }] },
                get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: ssh(COMMAND), reply: reply.ssh(compact(RULES)) }] }
            }
        }
    ]
};
