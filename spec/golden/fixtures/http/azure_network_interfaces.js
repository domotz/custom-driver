// Simulated Azure replies. Shape follows the Microsoft Entra v1 client-credentials token response, the Azure Resource
// Manager "Network Interfaces - List All" reply (Microsoft.Network, api-version 2023-02-01: { value: [ NetworkInterface ] }
// with name, id, location, kind, properties { provisioningState, resourceGuid, ipConfigurations[] { name, properties {
// provisioningState, privateIPAddress, privateIPAllocationMethod, privateIPAddressVersion, primary } }, dnsSettings {
// dnsServers, appliedDnsServers, internalDomainNameSuffix }, macAddress, enableAcceleratedNetworking, vnetEncryptionSupported,
// enableIPForwarding, disableTcpStateTracking, networkSecurityGroup { id }, primary, virtualMachine { id }, nicType }) and the
// Azure Monitor "Metrics - List" reply (api-version 2024-02-01: value[].name.value + timeseries[0].data[0] { timeStamp, total }).
// Metrics of a NIC are cumulative per sample, so the data point holds "total" rather than "average".
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const SUB = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.azure-token";

const nid = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Network/networkInterfaces/" + name;
const vid = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Compute/virtualMachines/" + name;

const nics = {
    value: [
        {
            name: "web-01-nic",
            id: nid("Prod-RG", "web-01-nic"),
            etag: "W/\"11111111-0000-0000-0000-000000000001\"",
            type: "Microsoft.Network/networkInterfaces",
            location: "westeurope",
            kind: "Regular",
            properties: {
                provisioningState: "Succeeded",
                resourceGuid: "aaaa0000-1111-2222-3333-444455556666",
                ipConfigurations: [{
                    name: "ipconfig1",
                    id: nid("Prod-RG", "web-01-nic") + "/ipConfigurations/ipconfig1",
                    type: "Microsoft.Network/networkInterfaces/ipConfigurations",
                    properties: { provisioningState: "Succeeded", privateIPAddress: "10.0.1.4", privateIPAllocationMethod: "Dynamic", primary: true, privateIPAddressVersion: "IPv4" }
                }],
                dnsSettings: { dnsServers: ["10.0.0.10", "10.0.0.11"], appliedDnsServers: ["10.0.0.10", "10.0.0.11"], internalDomainNameSuffix: "abc123.ax.internal.cloudapp.net" },
                macAddress: "00-0D-3A-12-34-56",
                enableAcceleratedNetworking: true,
                vnetEncryptionSupported: false,
                enableIPForwarding: false,
                disableTcpStateTracking: false,
                networkSecurityGroup: { id: "/subscriptions/" + SUB + "/resourceGroups/Prod-RG/providers/Microsoft.Network/networkSecurityGroups/web-01-nsg" },
                primary: true,
                virtualMachine: { id: vid("Prod-RG", "web-01") },
                hostedWorkloads: [],
                tapConfigurations: [],
                nicType: "Standard",
                allowPort25Out: true
            }
        },
        {
            name: "DB-01-NIC2",
            id: nid("Data-RG", "DB-01-NIC2"),
            type: "Microsoft.Network/networkInterfaces",
            location: "northeurope",
            kind: "Regular",
            properties: {
                provisioningState: "Succeeded",
                resourceGuid: "bbbb0000-1111-2222-3333-444455556666",
                ipConfigurations: [{
                    name: "ipconfig-secondary",
                    id: nid("Data-RG", "DB-01-NIC2") + "/ipConfigurations/ipconfig-secondary",
                    properties: { provisioningState: "Succeeded", privateIPAddress: "10.1.0.20", privateIPAllocationMethod: "Static", primary: true, privateIPAddressVersion: "IPv4" }
                }],
                dnsSettings: { dnsServers: [], appliedDnsServers: [], internalDomainNameSuffix: "def456.fx.internal.cloudapp.net" },
                macAddress: "00-0D-3A-AA-BB-CC",
                enableAcceleratedNetworking: false,
                vnetEncryptionSupported: false,
                enableIPForwarding: true,
                disableTcpStateTracking: false,
                primary: false,
                virtualMachine: { id: vid("Data-RG", "db-01") },
                nicType: "Standard"
            }
        }
    ]
};

const sample = (name, total) => ({
    id: "/subscriptions/" + SUB + "/providers/Microsoft.Insights/metrics/" + name,
    type: "Microsoft.Insights/metrics",
    name: { value: name, localizedValue: name },
    unit: "Count",
    timeseries: [{ metadatavalues: [], data: [{ timeStamp: "2026-01-15T09:59:00Z", total }] }],
    errorCode: "Success"
});

const metrics = (bs, br, ps, pr) => ({
    cost: 0, timespan: "2026-01-15T09:59:00Z/2026-01-15T10:00:00Z", interval: "PT1M", namespace: "Microsoft.Network/networkInterfaces", resourceregion: "westeurope",
    value: [sample("BytesSentRate", bs), sample("BytesReceivedRate", br), sample("PacketsSentRate", ps), sample("PacketsReceivedRate", pr)]
});

// The driver puts the lower-cased, sanitized NIC name in the metrics URL.
const metricsUrl = (rg, name) => "/subscriptions/" + SUB + "/resourceGroups/" + rg + "/providers/Microsoft.Network/networkInterfaces/" + name +
    "/providers/microsoft.insights/metrics?api-version=2024-02-01&metricnames=BytesSentRate,BytesReceivedRate,PacketsSentRate,PacketsReceivedRate&timespan=PT1M";

const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: "3599", ext_expires_in: "3599", expires_on: "1698400000", resource: "https://management.azure.com/", access_token: TOKEN })
    },
    {
        kind: "http", method: "get", host: "management.azure.com",
        target: "/subscriptions/" + SUB + "/providers/Microsoft.Network/networkInterfaces?api-version=2023-02-01",
        headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, nics)
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Prod-RG", "web-01-nic"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(1500000, 4200000, 9500, 12000))
    },
    {
        kind: "http", method: "get", host: "management.azure.com", target: metricsUrl("Data-RG", "db-01-nic2"), headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, metrics(250000, 800000, 1200, 2400))
    }
];

module.exports = {
    cases: [{
        name: "two nics, one with accelerated networking and one forwarding ip",
        parameters: { tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", subscriptionId: SUB, resourceGroups: ["all"], vmNames: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
