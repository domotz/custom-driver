// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response, the Azure Resource
// Manager "Disks - List" reply (Microsoft.Compute, api-version 2021-04-01: { value: [ Disk ] } with name, id, location,
// zones, managedBy, sku { name, tier }, properties { uniqueId, osType, hyperVGeneration, supportedCapabilities,
// creationData { createOption }, diskSizeGB, diskIOPSReadWrite, diskMBpsReadWrite, diskState, encryption { type },
// networkAccessPolicy, publicNetworkAccess, timeCreated, provisioningState, tier }) and the Azure Monitor "Metrics - List"
// reply (api-version 2024-02-01: value[].name.value + timeseries[0].data[0] { timeStamp, average }). A metric with no
// sample in the minute has a data point holding only timeStamp.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";

const did = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/disks/" + name;

const disks = {
    value: [
        {
            name: "web-01_OsDisk_1",
            id: did("Prod-RG", "web-01_OsDisk_1"),
            type: "Microsoft.Compute/disks",
            location: "westeurope",
            managedBy: "/subscriptions/" + SUB + "/resourceGroups/Prod-RG/providers/Microsoft.Compute/virtualMachines/web-01",
            zones: ["1"],
            sku: { name: "Premium_LRS", tier: "Premium" },
            properties: {
                timeCreated: "2025-12-01T08:30:00.1234567+00:00",
                osType: "Linux",
                hyperVGeneration: "V2",
                supportsHibernation: true,
                supportedCapabilities: { acceleratedNetwork: true, architecture: "x64" },
                creationData: { createOption: "FromImage", imageReference: { id: "/Subscriptions/" + SUB + "/Providers/Microsoft.Compute/Locations/westeurope/Publishers/Canonical/ArtifactTypes/VMImage/Offers/0001-com-ubuntu-server-jammy/Skus/22_04-lts-gen2/Versions/22.04.202311010" } },
                diskSizeGB: 30,
                diskIOPSReadWrite: 120,
                diskMBpsReadWrite: 25,
                encryption: { type: "EncryptionAtRestWithPlatformKey" },
                networkAccessPolicy: "AllowAll",
                publicNetworkAccess: "Enabled",
                tier: "P4",
                diskState: "Attached",
                diskSizeBytes: 32213303296,
                uniqueId: "11111111-aaaa-bbbb-cccc-000000000001",
                provisioningState: "Succeeded"
            }
        },
        {
            name: "db-01-data",
            id: did("Data-RG", "db-01-data"),
            type: "Microsoft.Compute/disks",
            location: "northeurope",
            sku: { name: "StandardSSD_LRS", tier: "Standard" },
            properties: {
                timeCreated: "2026-01-05T17:05:09.5+00:00",
                hyperVGeneration: "V1",
                supportedCapabilities: { architecture: "x64" },
                creationData: { createOption: "Empty" },
                diskSizeGB: 512,
                diskIOPSReadWrite: 500,
                diskMBpsReadWrite: 60,
                encryption: { type: "EncryptionAtRestWithPlatformKey" },
                networkAccessPolicy: "DenyAll",
                publicNetworkAccess: "Disabled",
                diskState: "Unattached",
                diskSizeBytes: 549755813888,
                uniqueId: "11111111-aaaa-bbbb-cccc-000000000002",
                provisioningState: "Succeeded"
            }
        }
    ]
};

const sample = (name, unit, point) => ({
    id: "/subscriptions/" + SUB + "/providers/Microsoft.Insights/metrics/" + name,
    type: "Microsoft.Insights/metrics",
    name: { value: name, localizedValue: name },
    unit,
    timeseries: [{ metadatavalues: [], data: [Object.assign({ timeStamp: "2026-01-15T09:59:00Z" }, point)] }],
    errorCode: "Success"
});

const metrics = (rb, wb, ro, wo, burst) => ({
    cost: 0, timespan: "2026-01-15T09:59:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.Compute/disks", resourceregion: "westeurope",
    value: [
        sample("Composite Disk Read Bytes/sec", "BytesPerSecond", { average: rb }),
        sample("Composite Disk Write Bytes/sec", "BytesPerSecond", { average: wb }),
        sample("Composite Disk Read Operations/sec", "CountPerSecond", { average: ro }),
        sample("Composite Disk Write Operations/sec", "CountPerSecond", { average: wo }),
        sample("DiskPaidBurstIOPS", "Count", burst === undefined ? {} : { average: burst })
    ]
});

const metricsUrl = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/disks/" + name +
    "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=Composite Disk Read Bytes/sec,Composite Disk Write Bytes/sec,Composite Disk Read Operations/sec,Composite Disk Write Operations/sec,DiskPaidBurstIOPS&timespan=PT1M";

const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.Compute/disks?api-version=2021-04-01",
        headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, disks)
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Prod-RG", "web-01_OsDisk_1"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(1048576.5, 524288.25, 25.5, 12.75))
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Data-RG", "db-01-data"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(0, 0, 0, 0))
    }
];

module.exports = {
    cases: [{
        name: "attached os disk and idle unattached data disk",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"], vmNames: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
