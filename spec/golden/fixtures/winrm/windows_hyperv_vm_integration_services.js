// Simulated Windows Server 2019 Hyper-V host / PowerShell 5.1 replies. Shape follows ConvertTo-Json (5.1, 4-space
// indent, two spaces after the colon) of `Get-VMIntegrationService | select-object id, name, enabled`: Id is
// "Microsoft:<vm id>\<service guid>", Name the service display name; the Guest Service Interface is disabled by
// default. A single service is a bare object.
const reply = require("../../replies");

const VM_ID = "5b0ff7ea-45cf-4f11-8c3c-1a4c27c0f5a1";
const COMMAND = 'Get-VMIntegrationService -vm (get-vm -id "' + VM_ID + '")  | select-object id, name, enabled | ConvertTo-json';

const GET_VM = [
    "",
    "Name  State   CPUUsage(%) MemoryAssigned(M) Uptime      Status             Version",
    "----  -----   ----------- ----------------- ------      ------             -------",
    "dc-01 Running 3           4096              12.03:25:41 Operating normally 9.0",
    "",
    ""
].join("\r\n");

const id = (guid) => "Microsoft:" + VM_ID.toUpperCase() + "\\" + guid;
const SERVICES = [
    { Id: id("6C09BB55-D683-4DA0-8931-C9BF705F6480"), Name: "Heartbeat", Enabled: true },
    { Id: id("2497F4DE-E9FA-4204-80E4-4B75C46419C0"), Name: "Time Synchronization", Enabled: true },
    { Id: id("9F8233AC-BE49-4C79-8EE3-E7E1985B2077"), Name: "Shutdown", Enabled: true },
    { Id: id("35FA2E29-EA23-4236-96AE-3A6EBACBA440"), Name: "Key-Value Pair Exchange", Enabled: true },
    { Id: id("5CED1297-4598-4915-A5FC-AD21BB4D02A4"), Name: "VSS", Enabled: true },
    { Id: id("68EC4D5E-1C47-4F6B-9F5D-3B1D5B9F0C13"), Name: "Guest Service Interface", Enabled: false }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const winrm = (target, stdout) => [{ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(stdout) }];
const entry = (data) => ({ validate: { calls: winrm("Get-vm", GET_VM) }, get_status: { calls: winrm(COMMAND, psJson(data)) } });

module.exports = {
    cases: [
        { name: "hyper-v vm, six services", parameters: { vmId: VM_ID }, entryPoints: entry(SERVICES) },
        { name: "hyper-v vm, one service is a bare object", parameters: { vmId: VM_ID }, entryPoints: entry(SERVICES[0]) }
    ]
};
