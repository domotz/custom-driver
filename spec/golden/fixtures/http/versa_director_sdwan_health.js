// Simulated Versa Director 22.1.4 replies. Shape follows the Versa Director northbound REST API: POST /auth/token
// ({ access_token, user: { organization } }) and GET /vnms/appliance/appliance, answering
// { "versanms.ApplianceStatusResult": { appliance: [{ name, uuid, ownerOrg, type, softwareVersion, startTime,
// "ping-status", "sync-status", "path-status", "controll-status", "services-status", "overall-status",
// templateStatus, "yang-compatibility-status", "inter-chassis-ha-status": { "ha-configured" }, Hardware: { model,
// manufacturer, memory, freeMemory, diskSize, freeDisk ("15.43GiB" strings), cpuCores, serialNo, ... },
// applianceLocation: { latitude, longitude } }] } }. The third appliance is unreachable and out of sync.
const reply = require("../../replies");

const TOKEN = { access_token: "eyJhbGciOiJSUzI1NiJ9.simulated", token_type: "Bearer", expires_in: 3600, user: { organization: "Acme" } };
const HDR = { Authorization: "Bearer " + TOKEN.access_token };

const INVENTORY = {
    "versanms.ApplianceStatusResult": {
        totalCount: 3,
        appliance: [
            {
                name: "branch-milan", uuid: "11111111-aaaa-4bbb-8ccc-000000000001", ownerOrg: "Acme", ownerOrgUuid: "9f8e7d6c-0000-4000-8000-00000000a001",
                type: "branch", deployment: "physical", connector: "Acme-Connector", connectorType: "Acme", branchId: "101", cmsOrg: "Acme",
                services: ["sdwan", "nextgen-firewall"], sngCount: 0,
                "ping-status": "REACHABLE", "sync-status": "IN_SYNC", "path-status": "REACHABLE", "controll-status": "Available",
                "services-status": "GOOD", "overall-status": "GOOD", templateStatus: "In Sync", "yang-compatibility-status": "Compatible",
                "inter-chassis-ha-status": { "ha-configured": false }, "intra-chassis-ha-status": { "ha-configured": true },
                stolenSuspected: false,
                softwareVersion: "22.1.4-GA abc1234 20240628 WSM Normal",
                Hardware: {
                    model: "CSG750", manufacturer: "Versa Networks", cpuCores: 4, memory: "15.43GiB", freeMemory: "9.02GiB",
                    diskSize: "98.30GiB", freeDisk: "73.72GiB", serialNo: "VSG750-0001", hardWareSerialNo: "HW-0001", firmwareVersion: "1.2.3"
                },
                ipAddress: "10.0.0.11", locationId: "Milan", applianceLocation: { latitude: "45.4642", longitude: "9.19" },
                startTime: "Mon Jan 5 10:00:00 2026", "last-updated-time": "2026-01-15 09:55:00", createdAt: "2024-07-01"
            },
            {
                name: "HUB-Frankfurt", uuid: "22222222-aaaa-4bbb-8ccc-000000000002", ownerOrg: "Acme",
                type: "hub", deployment: "virtual", services: ["sdwan"], sngCount: 2,
                "ping-status": "REACHABLE", "sync-status": "IN_SYNC", "path-status": "REACHABLE", "controll-status": "Available",
                "services-status": "GOOD", "overall-status": "GOOD", templateStatus: "In Sync", "yang-compatibility-status": "Compatible",
                "inter-chassis-ha-status": { "ha-configured": true }, "intra-chassis-ha-status": { "ha-configured": false },
                softwareVersion: "22.1.4-GA abc1234 20240628 WSM Normal",
                Hardware: { model: "Virtual Machine", manufacturer: "KVM", cpuCores: 0, memory: "16384MiB", freeMemory: "4096MiB", diskSize: "1.5TiB", freeDisk: "512GiB", serialNo: "VM-0002" },
                ipAddress: "10.0.1.1", locationId: "Frankfurt", applianceLocation: { latitude: 50.1109, longitude: 8.6821 },
                startTime: "Thu Dec 25 04:30:00 2025", "last-updated-time": "2026-01-15 09:55:00"
            },
            {
                name: "branch-rome", uuid: "33333333-aaaa-4bbb-8ccc-000000000003", ownerOrg: "Acme",
                type: "branch", deployment: "physical", services: ["sdwan"], sngCount: 0,
                "ping-status": "UNREACHABLE", "sync-status": "OUT_OF_SYNC", "path-status": "UNREACHABLE", "controll-status": "Unavailable",
                "services-status": "UNKNOWN", "overall-status": "CRITICAL", templateStatus: "Out of Sync", "yang-compatibility-status": "Incompatible",
                stolenSuspected: true,
                softwareVersion: "21.2.3-GA def5678 20230115",
                Hardware: { model: "CSG350", manufacturer: "Versa Networks", cpuCores: 2, memory: "3.7GiB", freeMemory: "0.4GiB", diskSize: "29.0GiB", freeDisk: "2.9GiB", serialNo: "VSG350-0003" },
                ipAddress: "10.0.3.11", locationId: "Rome",
                startTime: "not a date"
            }
        ]
    }
};

function calls(extra, limit) {
    const host = extra || {};
    return [
        Object.assign({ kind: "http", method: "post", target: "/auth/token", body: /grant_type/, reply: reply.http(200, TOKEN) }, host),
        Object.assign({ kind: "http", method: "get", target: "/vnms/appliance/appliance?offset=0&limit=" + (limit || 100), headers: HDR, reply: reply.http(200, INVENTORY) }, host)
    ];
}

const base = { clientId: "domotz-client", clientSecret: "s3cret" };

module.exports = {
    cases: [{
        name: "director by device ip",
        parameters: base,
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }, {
        name: "director by hostname with page size",
        parameters: Object.assign({}, base, { directorHost: "director.example.com", maxAppliances: "500" }),
        entryPoints: {
            validate: { calls: calls({ host: "director.example.com" }, 500) },
            get_status: { calls: calls({ host: "director.example.com" }, 500) }
        }
    }]
};
