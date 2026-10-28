// Simulated HP Poly Lens (cloud, GraphQL) replies. Shape follows the Poly Lens GraphQL API the driver queries:
// POST https://login.lens.poly.com/oauth/token (client_credentials) answers { access_token, token_type,
// expires_in }; POST https://api.silica-prod01.io.lens.poly.com/graphql answers { data: { deviceSearch: { edges:
// [{ node }] } } } (query allDevices), { data: { device: {...} } } (query getDevice) or
// { data: { rebootDevice: { success, error } } } (mutation reboot); GraphQL errors come as
// { errors: [{ message, extensions: { code, permissions, resource: { id, type } } }], data }. Fields the
// vendor schema leaves empty for a device (no Teams account) come back as null.
// The fake device has MAC 00:00:5E:00:53:01, serial SN0001 and IP 192.0.2.10. Cases follow the documented values of
// the cloudControllerDeviceID parameter: a Poly object id, "null" (MAC lookup), "all" (inventory table) and
// "error" (GraphQL errors as variables). The IP-only lookup cannot be expressed: the fake device always has a MAC.
const reply = require("../../replies");

const TOKEN = "eyJhbGciOiJSUzI1NiJ9.simulated.token";
const ID = "a6f1c2d3-4b5e-4f60-8a7b-9c0d1e2f3a4b";
const json = (body) => reply.http(200, body, { "content-type": "application/json" });

const tokenCall = { kind: "http", method: "post", host: "login.lens.poly.com", protocol: "https", target: "/oauth/token", body: /"grant_type":"client_credentials"/, reply: json({ access_token: TOKEN, token_type: "Bearer", expires_in: 86400 }) };
const gql = (pattern, body) => ({ kind: "http", method: "post", host: "api.silica-prod01.io.lens.poly.com", protocol: "https", target: "/graphql", headers: { Authorization: "Bearer " + TOKEN }, body: pattern, reply: json(body) });

const node = (over) => Object.assign({
    id: ID, name: "wpp-studio-x50", displayName: "Boardroom Studio X50", serialNumber: "SN0001", connected: true, hardwareModel: "Poly Studio X50",
    softwareVersion: "4.3.0-541008", macAddress: "00:00:5E:00:53:01", internalIp: "192.0.2.10", tenantId: "tnt-7788"
}, over);

const detail = (over) => Object.assign(node({}), {
    room: { name: "Boardroom", floor: "2", capacity: 12, type: "Conference", size: "Large" },
    connections: [{ name: "Poly TC10", id: "c-1", connected: true }, { name: "Poly Sync 20", id: "c-2", connected: false }],
    hardwareFamily: "Studio X", hardwareRevision: "B", softwareBuild: "541008", externalIp: "203.0.113.9", lastDetected: "2026-01-15T09:58:12Z",
    dateRegistered: "2024-06-03T14:22:00Z", shipmentDate: "2024-05-20T00:00:00Z", productId: "p-100", organization: "Example Org", manufacturer: "Poly",
    callStatus: "NOT_IN_CALL", provisioningState: "PROVISIONED", zoomRoomStatus: "Available", teamsDeviceHealthStatus: null,
    product: { name: "Studio X50", id: "p-100" }, model: { name: "Studio X50", id: "m-50" }, tenant: { id: "tnt-7788", name: "Example Org" }
}, over);

const edges = (nodes) => ({ data: { deviceSearch: { edges: nodes.map((n) => ({ node: n })) } } });
const inventory = edges([node({ id: "other-id", name: "wpp-trio-8500", displayName: "Huddle Trio", serialNumber: "SN7777", connected: false, hardwareModel: "Poly Trio 8500", macAddress: "00:04:F2:AA:BB:CC", internalIp: "192.0.2.77" }), node({})]);

const ALL = /allDevices/;
const nullOnTeams = { nullValues: ["teams-health-status"] }; // a device without a Teams account: GraphQL returns null
const reboot = gql(/rebootDevice/, { data: { rebootDevice: { success: true, error: null } } });

module.exports = {
    cases: [
        {
            name: "poly object id given",
            parameters: { client_id: "cid", client_secret: "csecret", cloudControllerDeviceID: ID },
            entryPoints: {
                validate: { calls: [tokenCall, gql(ALL, inventory)] },
                get_status: { calls: [tokenCall, gql(/getDevice/, { data: { device: detail({}) } })], expect: nullOnTeams },
                custom_1: { calls: [tokenCall, reboot] }
            }
        },
        {
            name: "null: lookup by MAC address",
            parameters: { client_id: "cid", client_secret: "csecret", cloudControllerDeviceID: "null" },
            entryPoints: {
                validate: { calls: [tokenCall, gql(ALL, inventory)] },
                get_status: { calls: [tokenCall, gql(/"field":"macAddress","contains":"00:00:5e:00:53:01"/, edges([detail({})]))], expect: nullOnTeams },
                custom_1: { calls: [tokenCall, gql(ALL, inventory), reboot] }
            }
        },
        {
            name: "all: inventory table",
            parameters: { client_id: "cid", client_secret: "csecret", cloudControllerDeviceID: "all" },
            entryPoints: {
                validate: { calls: [tokenCall] },
                // only the "Api response outcomes" variable and the device table are published in this mode
                get_status: { calls: [tokenCall, gql(ALL, inventory)], expect: { skipExpectedVariables: true } },
                custom_1: { calls: [tokenCall, gql(ALL, inventory), reboot] }
            }
        },
        {
            name: "error: permission error with partial data",
            parameters: { client_id: "cid", client_secret: "csecret", cloudControllerDeviceID: "error" },
            entryPoints: {
                validate: { calls: [tokenCall, gql(ALL, inventory)] },
                // the driver publishes one variable group per GraphQL error instead of the monitoring variables
                get_status: {
                    calls: [tokenCall, gql(ALL, Object.assign({
                        errors: [{ message: "Not authorized to read tenant", extensions: { code: "FORBIDDEN", permissions: ["device.read", "tenant.read"], resource: { id: "tnt-7788", type: "tenant" } } }]
                    }, inventory))],
                    expect: { skipExpectedVariables: true }
                },
                custom_1: { calls: [tokenCall, gql(ALL, inventory), reboot] }
            }
        }
    ]
};
