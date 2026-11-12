// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response, the Azure Resource
// Manager "Container Groups - List" reply (Microsoft.ContainerInstance, api-version 2024-05-01-preview: { value: [ ContainerGroup ] }
// with properties.containers[].properties { image, resources.requests { cpu, memoryInGB } }, properties.ipAddress,
// osType, restartPolicy, provisioningState) and the Azure Monitor "Metrics - List" reply (api-version 2024-02-01:
// { value: [ { id, type, name: { value, localizedValue }, unit, timeseries: [ { metadatavalues, data: [ { timeStamp, average } ] } ] } ] }).
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";
const GB = 1024 * 1024 * 1024;

const rid = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.ContainerInstance/containerGroups/" + name;

const groups = {
    value: [
        {
            id: rid("Prod-RG", "web-group"),
            name: "web-group",
            type: "Microsoft.ContainerInstance/containerGroups",
            location: "westeurope",
            properties: {
                sku: "Standard",
                provisioningState: "Succeeded",
                osType: "Linux",
                restartPolicy: "Always",
                ipAddress: { type: "Public", ip: "20.50.10.7", dnsNameLabel: "web-group-prod", fqdn: "web-group-prod.westeurope.azurecontainer.io", ports: [{ protocol: "TCP", port: 80 }] },
                containers: [
                    { name: "nginx", properties: { image: "nginx:1.25", ports: [{ port: 80 }], resources: { requests: { memoryInGB: 1.5, cpu: 1 } } } },
                    { name: "sidecar", properties: { image: "mcr.microsoft.com/azuredocs/aci-helloworld:latest", resources: { requests: { memoryInGB: 0.5, cpu: 0.5 } } } }
                ]
            }
        },
        {
            id: rid("Batch-RG", "batch-job"),
            name: "batch-job",
            type: "Microsoft.ContainerInstance/containerGroups",
            location: "northeurope",
            properties: {
                provisioningState: "Failed",
                osType: "Windows",
                restartPolicy: "Never",
                ipAddress: { type: "Private", ip: "10.0.2.4", ports: [] },
                containers: [
                    { name: "worker", properties: { image: "myregistry.azurecr.io/worker:2.1", resources: { requests: { memoryInGB: 4, cpu: 2 } } } }
                ]
            }
        }
    ]
};

const metrics = (cpu, mem, rx, tx) => {
    const one = (name, unit, value) => ({
        id: "/subscriptions/" + SUB + "/providers/Microsoft.Insights/metrics/" + name,
        type: "Microsoft.Insights/metrics",
        name: { value: name, localizedValue: name },
        unit,
        timeseries: [{ metadatavalues: [], data: [{ timeStamp: "2026-01-15T09:59:00Z", average: value }] }],
        errorCode: "Success"
    });
    return {
        cost: 59, timespan: "2026-01-15T09:59:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.ContainerInstance/containerGroups", resourceregion: "westeurope",
        value: [one("CpuUsage", "Count", cpu), one("MemoryUsage", "Bytes", mem), one("NetworkBytesReceivedPerSecond", "BytesPerSecond", rx), one("NetworkBytesTransmittedPerSecond", "BytesPerSecond", tx)]
    };
};

const metricsUrl = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.ContainerInstance/containerGroups/" + name +
    "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=CpuUsage,MemoryUsage,NetworkBytesReceivedPerSecond,NetworkBytesTransmittedPerSecond&timespan=PT1M";

const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.ContainerInstance/containerGroups?api-version=2024-05-01-preview",
        headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, groups)
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Prod-RG", "web-group"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(250, 1.25 * GB, 2.5 * 1024 * 1024, 1024 * 1024))
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Batch-RG", "batch-job"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(1800, 3 * GB, 0, 512 * 1024))
    }
];

module.exports = {
    cases: [{
        name: "two container groups, one failed",
        parameters: { tenantID: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"], containerNames: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
