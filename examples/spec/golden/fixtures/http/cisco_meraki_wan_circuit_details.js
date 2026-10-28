// Simulated Meraki Dashboard API v1 replies. Shape follows the API reference: getOrganization,
// getOrganizationDevices (name, notes, tags[], serial, model, mac, ...) and
// getOrganizationApplianceUplinkStatuses ([{ networkId, serial, model, lastReportedAt, uplinks: [{ interface,
// status, ip, gateway, publicIp, primaryDns, secondaryDns, ipAssignedBy }], highAvailability: { enabled, role } }]).
// Two MX appliances: an HA primary with WAN1 active and WAN2 failed, and a spare with WAN1 ready plus a cellular
// uplink. Case 2 filters the table by the management MAC of the first appliance.
const reply = require("../../replies");

const HOST = "api.meraki.com";
const ORG = "549236";
const KEY = "75dd5334bef4d2bc96f26138ae0a7b4a4ce5f7f1";
const headers = { "X-Cisco-Meraki-API-Key": KEY };

const organization = { id: ORG, name: "Acme Retail", url: "https://n1.meraki.com/o/xyz/manage/organization/overview", api: { enabled: true } };

const devices = [
    { name: "HQ-MX-1", serial: "Q2KD-AAAA-0001", mac: "e0:55:3d:aa:bb:01", model: "MX85", networkId: "N_111", productType: "appliance",
        tags: ["hq", "primary"], notes: "WAN1: Fiber 1G ISP-A | WAN2: DSL backup ISP-B", firmware: "wired-18-211-2" },
    { name: "", serial: "Q2KD-BBBB-0002", mac: "e0:55:3d:aa:bb:02", model: "MX68CW", networkId: "N_222", productType: "appliance",
        tags: [], notes: "Branch spare unit", firmware: "wired-18-211-2" },
    { name: "HQ-Switch", serial: "Q2XX-CCCC-0003", mac: "e0:55:3d:aa:bb:03", model: "MS225-48", networkId: "N_111", productType: "switch", tags: [], notes: "" }
];

const statuses = [
    { networkId: "N_111", serial: "Q2KD-AAAA-0001", model: "MX85", lastReportedAt: "2026-01-15T09:58:12.000000Z",
        highAvailability: { enabled: true, role: "primary" },
        uplinks: [
            { interface: "wan1", status: "active", ip: "203.0.113.10", gateway: "203.0.113.1", publicIp: "203.0.113.10", primaryDns: "9.9.9.9", secondaryDns: "149.112.112.112", ipAssignedBy: "static" },
            { interface: "wan2", status: "failed", ip: "198.51.100.20", gateway: "198.51.100.1", publicIp: "198.51.100.20", primaryDns: "198.51.100.1", secondaryDns: "", ipAssignedBy: "dhcp" }
        ] },
    { networkId: "N_222", serial: "Q2KD-BBBB-0002", model: "MX68CW", lastReportedAt: "2026-01-15T09:57:40.000000Z",
        highAvailability: { enabled: false },
        uplinks: [
            { interface: "wan1", status: "ready", ip: "192.0.2.50", gateway: "192.0.2.1", publicIp: "192.0.2.50", primaryDns: "8.8.8.8", secondaryDns: "8.8.4.4", ipAssignedBy: "dhcp" },
            { interface: "cellular", status: "not connected", provider: "Vodafone", publicIp: "" }
        ] }
];

const base = "/api/v1/organizations/" + ORG;
const json = (body) => reply.http(200, body, { "content-type": "application/json" });
const statusCalls = [
    { kind: "http", method: "get", host: HOST, headers, target: base + "/devices?perPage=1000", reply: json(devices) },
    { kind: "http", method: "get", host: HOST, headers, target: base + "/appliance/uplink/statuses?perPage=1000", reply: json(statuses) }
];
const validateCalls = [{ kind: "http", method: "get", host: HOST, headers, target: base, reply: json(organization) }];

module.exports = {
    cases: [
        {
            name: "two appliances, all uplinks",
            parameters: { apiKey: KEY, organizationId: ORG, macAddresses: "" },
            entryPoints: { validate: { calls: validateCalls }, get_status: { calls: statusCalls } }
        },
        {
            name: "filtered by management MAC",
            parameters: { apiKey: KEY, organizationId: ORG, macAddresses: "E0-55-3D-AA-BB-01" },
            entryPoints: { validate: { calls: validateCalls }, get_status: { calls: statusCalls } }
        }
    ]
};
