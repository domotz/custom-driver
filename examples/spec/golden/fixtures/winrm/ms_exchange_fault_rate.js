// Simulated Exchange Server 2019 CU12 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of Get-Counter's
// CounterSamples (path, InstanceName, CookedValue): lower-cased path, one sample per instance and counter, instance
// names of the ESE database instances ("information store - <database>"), rates per second.
// A single counter sample would be a bare object, not an array.
const reply = require("../../replies");

const COUNTERS = [
    "\\MSExchange Database(*)\\Database Page Fault Stalls/sec",
    "\\MSExchange Database(*)\\Database Page Faults/sec"
];
const COMMAND = "Get-Counter -Counter " + COUNTERS.map((c) => '"' + c + '"').join(",") + " | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json";

const path = (instance, counter) => "\\\\ex01.contoso.local\\msexchange database(" + instance + ")\\" + counter;
// Samples come grouped by counter, in the order of the command.
const SAMPLES = [
    { Path: path("information store - mbxdb01", "database page fault stalls/sec"), InstanceName: "information store - mbxdb01", CookedValue: 0 },
    { Path: path("information store - mbxdb02", "database page fault stalls/sec"), InstanceName: "information store - mbxdb02", CookedValue: 2.75 },
    { Path: path("information store - mbxdb01", "database page faults/sec"), InstanceName: "information store - mbxdb01", CookedValue: 18.5 },
    { Path: path("information store - mbxdb02", "database page faults/sec"), InstanceName: "information store - mbxdb02", CookedValue: 240.125 }
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
