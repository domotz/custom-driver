// Simulated Exchange Server 2019 CU12 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of Get-Counter's
// CounterSamples (path, InstanceName, CookedValue, CounterType): Path is lower-cased, InstanceName is "" for
// counters without instances, CounterType is the PerformanceCounterType enum as a number in 5.1
// (272696320 RateOfCountsPerSecond32, 65536 NumberOfItems32).
const reply = require("../../replies");

const COUNTERS = [
    "\\MSExchange OWA\\Requests/sec",
    "\\MSExchange Availability Service\\Availability Requests (sec)",
    "\\MSExchange MapiHttp Emsmdb\\User Count",
    "\\MSExchangeAutodiscover\\Requests/sec"
];
const COMMAND = "Get-Counter -Counter " + COUNTERS.map((c) => '"' + c + '"').join(",") + " | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue, CounterType  } | ConvertTo-Json";

const SAMPLES = [
    { Path: "\\\\ex01.contoso.local\\msexchange owa\\requests/sec", InstanceName: "", CookedValue: 1.2549, CounterType: 272696320 },
    { Path: "\\\\ex01.contoso.local\\msexchange availability service\\availability requests (sec)", InstanceName: "", CookedValue: 0.0, CounterType: 272696320 },
    { Path: "\\\\ex01.contoso.local\\msexchange mapihttp emsmdb\\user count", InstanceName: "", CookedValue: 214, CounterType: 65536 },
    { Path: "\\\\ex01.contoso.local\\msexchangeautodiscover\\requests/sec", InstanceName: "", CookedValue: 3.5, CounterType: 272696320 }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const calls = () => [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(SAMPLES)) }];

module.exports = {
    cases: [{
        name: "exchange, four counters",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
