// Simulated Exchange Server 2019 CU12 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of
// Get-Counter's CounterSamples (Select-Object path, InstanceName, CookedValue): Path is the lower-cased counter path
// "\\<host>\<object>(<instance>)\<counter>", InstanceName is the lower-cased IIS site, CookedValue a double.
// `Get-Counter "\Web Service(*)\Current Connections"` lists _total plus every site. A single instance would be a
// bare object, not an array.
const reply = require("../../replies");

const COMMAND = 'Get-Counter -Counter "\\Web Service(*)\\Current Connections" | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json';

const sample = (instance, value) => ({
    Path: "\\\\ex01.contoso.local\\web service(" + instance + ")\\current connections",
    InstanceName: instance,
    CookedValue: value
});
const SAMPLES = [
    sample("_total", 37),
    sample("default web site", 4),
    sample("exchange back end", 31)
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const calls = (samples) => [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(samples)) }];

module.exports = {
    cases: [{
        name: "exchange, three web service instances",
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
