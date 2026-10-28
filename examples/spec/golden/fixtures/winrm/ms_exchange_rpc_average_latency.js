// Simulated Exchange Server 2019 CU12 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of Get-Counter's
// CounterSamples (path, InstanceName, CookedValue) for "MSExchangeIS Store(*)\RPC Average Latency" (milliseconds):
// lower-cased path and instance names (_total plus one per mailbox database). A single instance would be a bare
// object, not an array.
const reply = require("../../replies");

const COMMAND = 'Get-Counter -Counter "\\MSExchangeIS Store(*)\\RPC Average Latency" | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json';

const sample = (instance, value) => ({
    Path: "\\\\ex01.contoso.local\\msexchangeis store(" + instance + ")\\rpc average latency",
    InstanceName: instance,
    CookedValue: value
});
const SAMPLES = [
    sample("_total", 2),
    sample("mbxdb01", 1),
    sample("mbxdb02", 14),
    sample("public folders", 0)
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const calls = (samples) => [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(samples)) }];

module.exports = {
    cases: [{
        name: "exchange, four instances",
        entryPoints: { validate: { calls: calls(SAMPLES) }, get_status: { calls: calls(SAMPLES) } }
    }, {
        name: "exchange, a single instance is a bare object",
        entryPoints: {
            validate: { calls: calls(SAMPLES[0]) },
            get_status: { calls: calls(SAMPLES[0]) }
        }
    }]
};
