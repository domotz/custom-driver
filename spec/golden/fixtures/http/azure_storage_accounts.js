// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response, the Azure Resource
// Manager "Storage Accounts - List" reply (Microsoft.Storage, api-version 2024-01-01: { value: [ StorageAccount ] } with name,
// id, location, kind, sku { name, tier }, properties { provisioningState, creationTime, primaryLocation, statusOfPrimary })
// and the Azure Monitor "Metrics - List" reply (api-version 2024-02-01: value[].name.value + timeseries[0].data[] of
// { timeStamp, <aggregation> }, oldest first; the driver reads the last point). Without an aggregation parameter Azure returns the
// metric's primary aggregation: average for Availability, latencies and UsedCapacity, total for Egress, Ingress and Transactions.
// A point with no sample in its interval holds only timeStamp.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";

const aid = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Storage/storageAccounts/" + name;

const accounts = {
    value: [
        {
            sku: { name: "Standard_LRS", tier: "Standard" },
            kind: "StorageV2",
            id: aid("Prod-RG", "prodstore01"),
            name: "prodstore01",
            type: "Microsoft.Storage/storageAccounts",
            location: "westeurope",
            properties: {
                provisioningState: "Succeeded",
                creationTime: "2024-05-12T10:11:12.1234567Z",
                primaryLocation: "westeurope",
                statusOfPrimary: "available",
                accessTier: "Hot"
            }
        },
        {
            sku: { name: "Premium_ZRS", tier: "Premium" },
            kind: "FileStorage",
            id: aid("Data-RG", "datafiles02"),
            name: "datafiles02",
            type: "Microsoft.Storage/storageAccounts",
            location: "northeurope",
            properties: {
                provisioningState: "Succeeded",
                creationTime: "2025-09-03T01:02:03Z",
                primaryLocation: "northeurope",
                statusOfPrimary: "unavailable"
            }
        }
    ]
};

const series = (name, unit, points) => ({
    id: "/subscriptions/" + SUB + "/providers/Microsoft.Insights/metrics/" + name,
    type: "Microsoft.Insights/metrics",
    name: { value: name, localizedValue: name },
    unit,
    timeseries: points ? [{ metadatavalues: [], data: points }] : [],
    errorCode: "Success"
});
const T = (m) => "2026-01-15T09:" + m + ":00Z";

const metrics1 = {
    cost: 0, timespan: "2026-01-15T09:00:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.Storage/storageAccounts", resourceregion: "westeurope",
    value: [
        series("Availability", "Percent", [{ timeStamp: T("57"), average: 100 }, { timeStamp: T("58"), average: 99.5 }]),
        series("Egress", "Bytes", [{ timeStamp: T("57"), total: 100 }, { timeStamp: T("58"), total: 5242880 }]),
        series("Ingress", "Bytes", [{ timeStamp: T("57"), total: 100 }, { timeStamp: T("58"), total: 1572864 }]),
        series("SuccessE2ELatency", "MilliSeconds", [{ timeStamp: T("58"), average: 32.4567 }]),
        series("SuccessServerLatency", "MilliSeconds", [{ timeStamp: T("58"), average: 21.5 }]),
        series("Transactions", "Count", [{ timeStamp: T("58"), total: 480 }]),
        series("UsedCapacity", "Bytes", [{ timeStamp: T("58"), average: 107374182400 }])
    ]
};
// The premium file account was idle in the last minute: latency/availability points carry no sample.
const metrics2 = {
    cost: 0, timespan: "2026-01-15T09:00:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.Storage/storageAccounts", resourceregion: "northeurope",
    value: [
        series("Availability", "Percent", [{ timeStamp: T("57"), average: 100 }, { timeStamp: T("58") }]),
        series("Egress", "Bytes", [{ timeStamp: T("58"), total: 2048 }]),
        series("Ingress", "Bytes", [{ timeStamp: T("58"), total: 4096 }]),
        series("SuccessE2ELatency", "MilliSeconds", [{ timeStamp: T("57"), average: 5 }, { timeStamp: T("58") }]),
        series("SuccessServerLatency", "MilliSeconds", [{ timeStamp: T("58") }]),
        series("Transactions", "Count", [{ timeStamp: T("58"), total: 12 }]),
        series("UsedCapacity", "Bytes", [{ timeStamp: T("58"), average: 5497558138880 }])
    ]
};

const metricsUrl = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Storage/storageAccounts/" + name +
    "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=Availability,Egress,Ingress,SuccessE2ELatency,SuccessServerLatency,Transactions,UsedCapacity&timespan=PT1H";

const auth = { Authorization: "Bearer " + TOKEN };
const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.Storage/storageAccounts?api-version=2024-01-01", headers: auth,
        reply: reply.http(200, accounts)
    },
    { kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Prod-RG", "prodstore01"), headers: auth, reply: reply.http(200, metrics1) },
    { kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Data-RG", "datafiles02"), headers: auth, reply: reply.http(200, metrics2) }
];

module.exports = {
    cases: [{
        name: "standard account and idle premium file account with unavailable primary",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
