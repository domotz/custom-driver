// Simulated Windows 11 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of the PSCustomObject the script builds
// from Get-NetIPInterface (MSFT_NetIPInterface): Dhcp (Disabled 0, Enabled 1) and ConnectionState (Disconnected 0,
// Connected 1) are CIM enums, written as numbers by 5.1; IPv4Addresses is a bare string for one address and an array
// for several. A single interface is a bare object. The SSH mode runs the same command through `powershell -Command`.
const reply = require("../../replies");

const ALIASES = ["Ethernet", "Wi-Fi"];
const COMMAND = "Get-NetIPInterface -AddressFamily IPv4 | Where-Object { (\"Ethernet\", \"Wi-Fi\") -contains $_.InterfaceAlias } | ForEach-Object { [PSCustomObject]@{ InterfaceAlias = $_.InterfaceAlias; DhcpEnabled = $_.Dhcp; ConnectionState = $_.ConnectionState; IPv4Addresses = (Get-NetIPAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).IPAddress } } | ConvertTo-Json";
const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';

const VALIDATE_OUTPUT = [
    "",
    "ifIndex InterfaceAlias                  Address Family NlMtu(Bytes) InterfaceMetric Dhcp     ConnectionState PolicyStore",
    "------- --------------                  -------------- ------------ --------------- ----     --------------- -----------",
    "12      Wi-Fi                                     IPv4         1500              35 Enabled  Disconnected    ActiveStore",
    "7       Ethernet                                  IPv4         1500               5 Disabled Connected       ActiveStore",
    "1       Loopback Pseudo-Interface 1               IPv4   4294967295              75 Disabled Connected       ActiveStore",
    "",
    ""
].join("\r\n");

// Ethernet: static address, connected. Wi-Fi: DHCP, disconnected, two addresses.
const INTERFACES = [
    { InterfaceAlias: "Ethernet", DhcpEnabled: 0, ConnectionState: 1, IPv4Addresses: "192.168.1.20" },
    { InterfaceAlias: "Wi-Fi", DhcpEnabled: 1, ConnectionState: 0, IPv4Addresses: ["192.168.1.55", "169.254.12.3"] }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";

function winrm(name, data) {
    return {
        name,
        parameters: { interfaceAliases: ALIASES, protocol: "winrm" },
        entryPoints: {
            validate: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: "Get-NetIPInterface", reply: reply.winrm(VALIDATE_OUTPUT) }] },
            get_status: { calls: [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(data)) }] }
        }
    };
}

module.exports = {
    cases: [
        winrm("winrm, ethernet and wi-fi", INTERFACES),
        winrm("winrm, one interface is a bare object", INTERFACES[0]),
        {
            name: "ssh, ethernet and wi-fi",
            parameters: { interfaceAliases: ALIASES, protocol: "ssh" },
            entryPoints: {
                validate: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: ssh("Get-NetIPInterface"), reply: reply.ssh(VALIDATE_OUTPUT) }] },
                get_status: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: ssh(COMMAND), reply: reply.ssh(psJson(INTERFACES)) }] }
            }
        }
    ]
};
