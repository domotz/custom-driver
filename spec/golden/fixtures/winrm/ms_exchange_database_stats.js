// Simulated Exchange Server 2019 CU12 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of Get-Counter's
// CounterSamples (path, InstanceName, CookedValue): lower-cased path, one sample per instance and counter, instance
// names of the ESE database instances ("information store - <database>"), latencies in milliseconds.
// A single database with both counters gives four samples; a single counter sample would be a bare object.
const reply = require("../../replies");

const COUNTERS = [
    "\\MSExchange Database(*)\\I/O Database Reads Average Latency",
    "\\MSExchange Database(*)\\I/O Database Writes Average Latency"
];
const COMMAND = "Get-Counter -Counter " + COUNTERS.map((c) => '"' + c + '"').join(",") + " | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json";

const path = (instance, counter) => "\\\\ex01.contoso.local\\msexchange database(" + instance + ")\\" + counter;
// Samples come grouped by counter, as Get-Counter returns them for several paths.
const SAMPLES = [
    { Path: path("information store - mbxdb01", "i/o database reads average latency"), InstanceName: "information store - mbxdb01", CookedValue: 4.25 },
    { Path: path("information store - mbxdb02", "i/o database reads average latency"), InstanceName: "information store - mbxdb02", CookedValue: 31.5 },
    { Path: path("information store - mbxdb01", "i/o database writes average latency"), InstanceName: "information store - mbxdb01", CookedValue: 1.5 },
    { Path: path("information store - mbxdb02", "i/o database writes average latency"), InstanceName: "information store - mbxdb02", CookedValue: 12 }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const calls = (samples) => [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(samples)) }];

module.exports = {
    cases: [{
        name: "exchange, two databases",
        entryPoints: { validate: { calls: calls(SAMPLES) }, get_status: { calls: calls(SAMPLES) } }
    }, {
        name: "exchange, a single sample is a bare object",
        entryPoints: {
            validate: { calls: calls(SAMPLES[0]) },
            get_status: { calls: calls(SAMPLES[0]) }
        }
    }]
};
