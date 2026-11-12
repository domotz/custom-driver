// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response, the Azure Resource
// Manager "Virtual Machine Scale Sets - List All" reply (Microsoft.Compute, api-version 2024-07-01: { value: [ VirtualMachineScaleSet ] };
// properties.uniqueId, properties.virtualMachineProfile.storageProfile { diskControllerType, osDisk { diskSizeGB } }) and the
// Azure Monitor "Metrics - List" reply (api-version 2024-02-01: value[].name.value + timeseries[0].data[0] { timeStamp, average | total }).
// Metrics with no samples (the second set has no data disks) come back with an empty timeseries.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";
const GB = 1024 * 1024 * 1024;

const sid = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/virtualMachineScaleSets/" + name;

const sets = {
    value: [
        {
            name: "web-vmss",
            id: sid("Prod-RG", "web-vmss"),
            type: "Microsoft.Compute/virtualMachineScaleSets",
            location: "westeurope",
            sku: { name: "Standard_D2s_v3", tier: "Standard", capacity: 3 },
            properties: {
                orchestrationMode: "Uniform",
                virtualMachineProfile: {
                    storageProfile: {
                        diskControllerType: "SCSI",
                        osDisk: { createOption: "FromImage", caching: "ReadWrite", diskSizeGB: 128, managedDisk: { storageAccountType: "Premium_LRS" } },
                        dataDisks: [{ lun: 0, createOption: "Empty", diskSizeGB: 256 }]
                    }
                },
                provisioningState: "Succeeded",
                uniqueId: "AAAA1111-0000-0000-0000-000000000001"
            }
        },
        {
            name: "batch-vmss",
            id: sid("Batch-RG", "batch-vmss"),
            type: "Microsoft.Compute/virtualMachineScaleSets",
            location: "northeurope",
            sku: { name: "Standard_D4ds_v5", tier: "Standard", capacity: 10 },
            properties: {
                orchestrationMode: "Flexible",
                virtualMachineProfile: {
                    storageProfile: {
                        diskControllerType: "NVMe",
                        osDisk: { createOption: "FromImage", caching: "None" }
                    }
                },
                provisioningState: "Succeeded",
                uniqueId: "BBBB2222-0000-0000-0000-000000000002"
            }
        }
    ]
};

// [metric name, unit, data point key]
const METRICS = [
    ["Disk Write Operations/Sec", "CountPerSecond", "average"],
    ["Disk Read Bytes", "Bytes", "total"],
    ["Disk Write Bytes", "Bytes", "total"],
    ["Disk Read Operations/Sec", "CountPerSecond", "average"],
    ["Data Disk Read Bytes/sec", "BytesPerSecond", "average"],
    ["Data Disk Write Bytes/sec", "BytesPerSecond", "average"],
    ["Data Disk Read Operations/Sec", "CountPerSecond", "average"],
    ["Data Disk Write Operations/Sec", "CountPerSecond", "average"],
    ["Data Disk Bandwidth Consumed Percentage", "Percent", "average"],
    ["Data Disk IOPS Consumed Percentage", "Percent", "average"],
    ["Data Disk Target Bandwidth", "BytesPerSecond", "average"],
    ["Data Disk Target IOPS", "CountPerSecond", "average"],
    ["OS Disk Bandwidth Consumed Percentage", "Percent", "average"],
    ["OS Disk IOPS Consumed Percentage", "Percent", "average"],
    ["OS Disk Read Operations/Sec", "CountPerSecond", "average"],
    ["OS Disk Write Operations/Sec", "CountPerSecond", "average"],
    ["OS Disk Read Bytes/sec", "BytesPerSecond", "average"],
    ["OS Disk Write Bytes/sec", "BytesPerSecond", "average"]
];

const metrics = (values) => ({
    cost: 0, timespan: "2026-01-15T09:59:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.Compute/virtualMachineScaleSets", resourceregion: "westeurope",
    value: METRICS.map(([name, unit, key]) => ({
        id: "/subscriptions/" + SUB + "/providers/Microsoft.Insights/metrics/" + name,
        type: "Microsoft.Insights/metrics",
        name: { value: name, localizedValue: name },
        unit,
        timeseries: name in values ? [{ metadatavalues: [], data: [{ timeStamp: "2026-01-15T09:59:00Z", [key]: values[name] }] }] : [],
        errorCode: "Success"
    }))
});

const webValues = {
    "Disk Write Operations/Sec": 42.5, "Disk Read Bytes": 3 * GB, "Disk Write Bytes": 1.5 * GB, "Disk Read Operations/Sec": 17.25,
    "Data Disk Read Bytes/sec": 2048000, "Data Disk Write Bytes/sec": 1024000, "Data Disk Read Operations/Sec": 12, "Data Disk Write Operations/Sec": 30,
    "Data Disk Bandwidth Consumed Percentage": 8.5, "Data Disk IOPS Consumed Percentage": 4.25, "Data Disk Target Bandwidth": 125000000, "Data Disk Target IOPS": 1100,
    "OS Disk Bandwidth Consumed Percentage": 11.75, "OS Disk IOPS Consumed Percentage": 6.5, "OS Disk Read Operations/Sec": 5.5, "OS Disk Write Operations/Sec": 12.5,
    "OS Disk Read Bytes/sec": 512000, "OS Disk Write Bytes/sec": 256000
};
const batchValues = {
    "Disk Write Operations/Sec": 310, "Disk Read Bytes": 0.25 * GB, "Disk Write Bytes": 6 * GB, "Disk Read Operations/Sec": 20,
    "OS Disk Bandwidth Consumed Percentage": 71.5, "OS Disk IOPS Consumed Percentage": 93.25, "OS Disk Read Operations/Sec": 20, "OS Disk Write Operations/Sec": 310,
    "OS Disk Read Bytes/sec": 1500000, "OS Disk Write Bytes/sec": 52000000
};

const metricsUrl = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/virtualMachineScaleSets/" + name +
    "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + METRICS.map((m) => m[0]).join(",") + "&timespan=PT1M";

const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.Compute/virtualMachineScaleSets?api-version=2024-07-01",
        headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, sets)
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Prod-RG", "web-vmss"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(webValues))
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Batch-RG", "batch-vmss"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(batchValues))
    }
];

module.exports = {
    cases: [{
        name: "scale set with data disk and one without",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"], vmNames: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
