// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response, the Azure Resource
// Manager "Virtual Machine Scale Sets - List All" reply (Microsoft.Compute, api-version 2024-07-01: { value: [ VirtualMachineScaleSet ] }
// with name, id, location, etag, sku { name, tier, capacity }, properties { uniqueId, orchestrationMode, upgradePolicy { mode },
// scaleInPolicy { rules, forceDeletion }, virtualMachineProfile { osProfile, storageProfile { imageReference, osDisk },
// networkProfile.networkInterfaceConfigurations[] }, provisioningState, platformFaultDomainCount, timeCreated }) and the Azure
// Monitor "Metrics - List" reply (api-version 2024-02-01: value[].name.value + timeseries[0].data[0] { timeStamp, average | total }).
// osDisk.osType is only present for scale sets built from a specialized/custom image, so the platform-image set omits it.
// A burstable-credit metric on a non-burstable SKU has a data point with only timeStamp.
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";
const GB = 1024 * 1024 * 1024;

const sid = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/virtualMachineScaleSets/" + name;

const nicCfg = (name, ipName) => [{ name, properties: { primary: true, enableAcceleratedNetworking: false, ipConfigurations: [{ name: ipName, properties: { primary: true, privateIPAddressVersion: "IPv4" } }] } }];

const sets = {
    value: [
        {
            name: "web-vmss",
            id: sid("Prod-RG", "web-vmss"),
            type: "Microsoft.Compute/virtualMachineScaleSets",
            location: "westeurope",
            etag: "\"7\"",
            sku: { name: "Standard_B2s", tier: "Standard", capacity: 3 },
            properties: {
                singlePlacementGroup: true,
                orchestrationMode: "Uniform",
                upgradePolicy: { mode: "Manual" },
                scaleInPolicy: { rules: ["Default"], forceDeletion: false },
                virtualMachineProfile: {
                    osProfile: { computerNamePrefix: "webvm", adminUsername: "azureuser" },
                    storageProfile: {
                        osDisk: { createOption: "FromImage", caching: "ReadWrite", managedDisk: { storageAccountType: "Premium_LRS" } },
                        imageReference: { publisher: "Canonical", offer: "0001-com-ubuntu-server-jammy", sku: "22_04-lts-gen2", version: "latest" }
                    },
                    networkProfile: { networkInterfaceConfigurations: nicCfg("web-vmss-nic", "ipconfig1") }
                },
                provisioningState: "Succeeded",
                overprovision: true,
                uniqueId: "AAAA1111-0000-0000-0000-000000000001",
                platformFaultDomainCount: 5,
                timeCreated: "2025-10-12T07:08:09.1234567+00:00"
            }
        },
        {
            name: "batch-vmss",
            id: sid("Batch-RG", "batch-vmss"),
            type: "Microsoft.Compute/virtualMachineScaleSets",
            location: "northeurope",
            etag: "\"2\"",
            sku: { name: "Standard_D4s_v3", tier: "Standard", capacity: 10 },
            properties: {
                orchestrationMode: "Flexible",
                upgradePolicy: { mode: "Automatic" },
                scaleInPolicy: { rules: ["OldestVM"], forceDeletion: true },
                virtualMachineProfile: {
                    osProfile: { computerNamePrefix: "batch", adminUsername: "azureuser" },
                    storageProfile: {
                        osDisk: { osType: "Windows", createOption: "FromImage", caching: "None" },
                        imageReference: { publisher: "MicrosoftWindowsServer", offer: "WindowsServer", sku: "2022-datacenter-azure-edition", version: "20348.2113.231109" }
                    },
                    networkProfile: { networkInterfaceConfigurations: nicCfg("batch-nic", "batch-ipconfig") }
                },
                provisioningState: "Updating",
                uniqueId: "BBBB2222-0000-0000-0000-000000000002",
                platformFaultDomainCount: 1,
                timeCreated: "2026-01-02T23:59:01+00:00"
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

const metrics = (mem, out, inn, credits, cpu, used, avail) => ({
    cost: 0, timespan: "2026-01-15T09:59:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.Compute/virtualMachineScaleSets", resourceregion: "westeurope",
    value: [
        sample("Available Memory Bytes", "Bytes", { average: mem }),
        sample("Network Out Total", "Bytes", { total: out }),
        sample("Network In Total", "Bytes", { total: inn }),
        sample("CPU Credits Remaining", "Count", credits === undefined ? {} : { average: credits }),
        sample("Percentage CPU", "Percent", { average: cpu }),
        sample("CPU Credits Consumed", "Count", used === undefined ? {} : { average: used }),
        sample("VmAvailabilityMetric", "Count", { average: avail })
    ]
});

const metricsUrl = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/virtualMachineScaleSets/" + name +
    "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=Available Memory Bytes,Network Out Total,Network In Total,CPU Credits Remaining,Percentage CPU,CPU Credits Consumed,VmAvailabilityMetric&timespan=PT1M";

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
        reply: reply.http(200, metrics(2.5 * GB, 3 * GB, 1.25 * GB, 120, 35.75, 4.5, 1))
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Batch-RG", "batch-vmss"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(8 * GB, 0.5 * GB, 0.75 * GB, undefined, 88.2, undefined, 0.8))
    }
];

module.exports = {
    cases: [{
        name: "two scale sets, one updating",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"], vmNames: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
