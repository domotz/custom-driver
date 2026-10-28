// Simulated Exchange Server 2019 CU12 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of Get-Counter's
// CounterSamples (path, InstanceName, CookedValue) for "MSExchangeTransport Queues(*)": instances are the lower-cased
// queue names (_total, submission, unreachable, poison, aggregate delivery queues). The poison and unreachable queues
// hold messages (non-healthy rows). A single instance would be a bare object, not an array.
const reply = require("../../replies");

const COMMAND = 'Get-Counter -Counter "\\MSExchangeTransport Queues(*)\\Messages Queued For Delivery" | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json';

const sample = (instance, value) => ({
    Path: "\\\\ex01.contoso.local\\msexchangetransport queues(" + instance + ")\\messages queued for delivery",
    InstanceName: instance,
    CookedValue: value
});
const SAMPLES = [
    sample("_total", 58),
    sample("submission", 0),
    sample("unreachable", 12),
    sample("poison", 3),
    sample("aggregate delivery queue (all internal)", 40),
    sample("aggregate delivery queue (all external)", 3)
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const calls = (samples) => [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(samples)) }];

module.exports = {
    cases: [{
        name: "exchange, six queues",
        entryPoints: { validate: { calls: calls(SAMPLES) }, get_status: { calls: calls(SAMPLES) } }
    }, {
        name: "exchange, a single instance is a bare object",
        entryPoints: {
            validate: { calls: calls(SAMPLES[0]) },
            // one sample is fewer than the companion's full counter set
            get_status: { calls: calls(SAMPLES[0]), expect: { skipExpectedVariables: true } }
        }
    }]
};
