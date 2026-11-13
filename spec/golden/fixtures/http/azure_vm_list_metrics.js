// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response, the Azure Resource
// Manager "Virtual Machines - List All" reply (api-version 2021-04-01), the "Virtual Machines - Instance View" reply
// (api-version 2024-07-01: { computerName, osName, osVersion, vmAgent { vmAgentVersion, statuses, extensionHandlers[] { type,
// typeHandlerVersion, status { code, level, displayStatus, message } } }, disks, statuses: [ provisioning status, power state ] },
// a deallocated VM has no osName/osVersion/vmAgent) and the Azure Monitor "Metrics - List" reply (api-version 2024-02-01:
// value[].name.value + timeseries[0].data[0] { timeStamp, average | total }). The driver asks for 22 metrics in groups of 20,
// i.e. two requests per running VM; it only requests metrics for VMs whose power state is "VM running".
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";
const GB = 1024 * 1024 * 1024;

const vid = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/virtualMachines/" + name;

const vms = {
    value: [
        {
            name: "web-01", id: vid("Prod-RG", "web-01"), type: "Microsoft.Compute/virtualMachines", location: "westeurope", zones: ["1"],
            properties: {
                vmId: "0a1b2c3d-1111-2222-3333-444455556666",
                hardwareProfile: { vmSize: "Standard_D2s_v3" },
                storageProfile: { osDisk: { osType: "Linux", name: "web-01_OsDisk_1", createOption: "FromImage" }, dataDisks: [] },
                osProfile: { computerName: "web-01", adminUsername: "azureuser" },
                provisioningState: "Succeeded"
            }
        },
        {
            name: "db-01", id: vid("Data-RG", "db-01"), type: "Microsoft.Compute/virtualMachines", location: "northeurope",
            properties: {
                vmId: "9f8e7d6c-aaaa-bbbb-cccc-ddddeeeeffff",
                hardwareProfile: { vmSize: "Standard_E4s_v3" },
                storageProfile: { osDisk: { osType: "Windows", name: "db-01_OsDisk_1", createOption: "FromImage" }, dataDisks: [{ lun: 0, name: "db-01-data", createOption: "Attach", diskSizeGB: 512 }] },
                osProfile: { computerName: "DB01", adminUsername: "azureuser" },
                provisioningState: "Succeeded"
            }
        }
    ]
};

const status = (code, level, display) => ({ code, level, displayStatus: display });

const webView = {
    computerName: "web-01",
    osName: "ubuntu",
    osVersion: "22.04",
    vmAgent: {
        vmAgentVersion: "2.9.1.1",
        statuses: [{ code: "ProvisioningState/succeeded", level: "Info", displayStatus: "Ready", message: "Guest Agent is running", time: "2026-01-15T09:58:40+00:00" }],
        extensionHandlers: [{
            type: "Microsoft.Azure.Monitor.AzureMonitorLinuxAgent", typeHandlerVersion: "1.28.11",
            status: { code: "ProvisioningState/succeeded", level: "Info", displayStatus: "Ready", message: "Plugin enabled" }
        }]
    },
    disks: [{ name: "web-01_OsDisk_1", statuses: [status("ProvisioningState/succeeded", "Info", "Provisioning succeeded")] }],
    statuses: [status("ProvisioningState/succeeded", "Info", "Provisioning succeeded"), status("PowerState/running", "Info", "VM running")]
};
const dbView = {
    computerName: "DB01",
    disks: [{ name: "db-01_OsDisk_1", statuses: [status("ProvisioningState/succeeded", "Info", "Provisioning succeeded")] }],
    statuses: [status("ProvisioningState/succeeded", "Info", "Provisioning succeeded"), status("PowerState/deallocated", "Info", "VM deallocated")]
};

const KEYS = [
    ["Network Out Total", "Bytes", "total"], ["Network In Total", "Bytes", "total"], ["Available Memory Bytes", "Bytes", "average"],
    ["Percentage CPU", "Percent", "average"], ["CPU Credits Remaining", "Count", "average"], ["CPU Credits Consumed", "Count", "average"],
    ["Disk Read Bytes", "Bytes", "total"], ["Disk Write Bytes", "Bytes", "total"], ["Disk Read Operations/Sec", "CountPerSecond", "average"],
    ["Disk Write Operations/Sec", "CountPerSecond", "average"], ["Data Disk Read Bytes/sec", "BytesPerSecond", "average"],
    ["Data Disk Write Bytes/sec", "BytesPerSecond", "average"], ["Data Disk Latency", "MilliSeconds", "average"],
    ["OS Disk Read Bytes/sec", "BytesPerSecond", "average"], ["OS Disk Write Bytes/sec", "BytesPerSecond", "average"],
    ["OS Disk Latency", "MilliSeconds", "average"], ["OS Disk Read Operations/Sec", "CountPerSecond", "average"],
    ["OS Disk Write Operations/Sec", "CountPerSecond", "average"], ["VmAvailabilityMetric", "Count", "average"],
    ["Temp Disk Latency", "MilliSeconds", "average"], ["Temp Disk Read Bytes/sec", "BytesPerSecond", "average"], ["Temp Disk Write Bytes/sec", "BytesPerSecond", "average"]
];
const GROUP1 = KEYS.slice(0, 20);
const GROUP2 = KEYS.slice(20);

// Metrics a VM has no samples for (no data disk, no burstable credits) come back with an empty timeseries.
const webValues = {
    "Network Out Total": 2 * GB, "Network In Total": 0.5 * GB, "Available Memory Bytes": 3.25 * GB, "Percentage CPU": 23.456,
    "Disk Read Bytes": 0.125 * GB, "Disk Write Bytes": 0.375 * GB, "Disk Read Operations/Sec": 4.5, "Disk Write Operations/Sec": 11.2345,
    "OS Disk Read Bytes/sec": 450000, "OS Disk Write Bytes/sec": 900000, "OS Disk Latency": 1.8, "OS Disk Read Operations/Sec": 4.5,
    "OS Disk Write Operations/Sec": 11.25, "VmAvailabilityMetric": 1, "Temp Disk Latency": 0.4, "Temp Disk Read Bytes/sec": 12000, "Temp Disk Write Bytes/sec": 34000
};

const metrics = (group, values) => ({
    cost: 0, timespan: "2026-01-15T09:59:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.Compute/virtualMachines", resourceregion: "westeurope",
    value: group.map(([name, unit, key]) => ({
        id: "/subscriptions/" + SUB + "/providers/Microsoft.Insights/metrics/" + name,
        type: "Microsoft.Insights/metrics",
        name: { value: name, localizedValue: name },
        unit,
        timeseries: name in values ? [{ metadatavalues: [], data: [{ timeStamp: "2026-01-15T09:59:00Z", [key]: values[name] }] }] : [],
        errorCode: "Success"
    }))
});

const metricsUrl = (rg, name, group) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/virtualMachines/" + name +
    "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=" + group.map((m) => m[0]).join(",") + "&timespan=PT1M";

const auth = { Authorization: "Bearer " + TOKEN };
const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.Compute/virtualMachines?api-version=2021-04-01", headers: auth,
        reply: reply.http(200, vms)
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/resourceGroups/Prod-RG/providers/Microsoft.Compute/virtualMachines/web-01/instanceView?api-version=2024-07-01", headers: auth,
        reply: reply.http(200, webView)
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/resourceGroups/Data-RG/providers/Microsoft.Compute/virtualMachines/db-01/instanceView?api-version=2024-07-01", headers: auth,
        reply: reply.http(200, dbView)
    },
    { kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Prod-RG", "web-01", GROUP1), headers: auth, reply: reply.http(200, metrics(GROUP1, webValues)) },
    { kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Prod-RG", "web-01", GROUP2), headers: auth, reply: reply.http(200, metrics(GROUP2, webValues)) }
];

module.exports = {
    cases: [{
        name: "running linux vm and deallocated windows vm",
        parameters: { tenantID: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"], vmNames: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
