// Simulated Exchange Server 2019 CU12 / PowerShell 5.1 replies. Shape follows ConvertTo-Json of Get-Counter's
// CounterSamples (path, InstanceName, CookedValue) for "MSExchange ADAccess Domain Controllers(*)": lower-cased
// path, one instance per domain controller (FQDN), LDAP read/search times in milliseconds.
// A single counter sample would be a bare object, not an array.
const reply = require("../../replies");

const COUNTERS = [
    "\\MSExchange ADAccess Domain Controllers(*)\\LDAP Read Time",
    "\\MSExchange ADAccess Domain Controllers(*)\\LDAP Search Time"
];
const COMMAND = "Get-Counter -Counter " + COUNTERS.map((c) => '"' + c + '"').join(",") + " | ForEach-Object { $_.countersamples | Select-Object path, InstanceName, CookedValue } | ConvertTo-Json";

const path = (instance, counter) => "\\\\ex01.contoso.local\\msexchange adaccess domain controllers(" + instance + ")\\" + counter;
const SAMPLES = [
    { Path: path("dc01.contoso.local", "ldap read time"), InstanceName: "dc01.contoso.local", CookedValue: 3 },
    { Path: path("dc02.contoso.local", "ldap read time"), InstanceName: "dc02.contoso.local", CookedValue: 96 },
    { Path: path("dc01.contoso.local", "ldap search time"), InstanceName: "dc01.contoso.local", CookedValue: 5 },
    { Path: path("dc02.contoso.local", "ldap search time"), InstanceName: "dc02.contoso.local", CookedValue: 142 }
];

const psJson = (value) => JSON.stringify(value, null, 4).replace(/": /g, '":  ') + "\r\n";
const calls = (samples) => [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(psJson(samples)) }];

module.exports = {
    cases: [{
        name: "exchange, two domain controllers",
        entryPoints: { validate: { calls: calls(SAMPLES) }, get_status: { calls: calls(SAMPLES) } }
    }, {
        name: "exchange, a single sample is a bare object",
        entryPoints: {
            validate: { calls: calls(SAMPLES[0]) },
            get_status: { calls: calls(SAMPLES[0]) }
        }
    }]
};
