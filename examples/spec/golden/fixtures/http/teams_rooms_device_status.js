// Simulated Microsoft Graph replies. Shape follows the Microsoft identity platform v2.0 client-credentials token response
// ({ token_type, expires_in, ext_expires_in, access_token }) and the Microsoft Graph beta Teams devices API:
// GET /beta/teamwork/devices -> { "@odata.context", value: [ teamworkDevice { id, deviceType, healthStatus, activityState,
// currentUser { id, displayName, userIdentityType }, hardwareDetail { serialNumber, uniqueId, macAddresses, manufacturer, model } } ] } and
// GET /beta/teamwork/devices/{id}/health -> teamworkDeviceHealth { id, connection { connectionStatus }, loginStatus { exchangeConnection,
// teamsConnection }, peripheralsHealth { roomCameraHealth, contentCameraHealth, speakerHealth, communicationSpeakerHealth, microphoneHealth
// (each with connection.connectionStatus), displayHealthCollection[] }, softwareUpdateHealth { <component>SoftwareUpdateStatus {
// currentVersion, availableVersion, softwareFreshness } }, hardwareHealth { computeHealth, hdmiIngestHealth } }.
// Each device has one display, so the table has the 23 fixed columns plus "Display 1 Status" (24, as the companion expects).
const reply = require("../../replies");

const TENANT = "11111111-2222-3333-4444-555555555555";
const TOKEN = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.graph-token";
const ID1 = "11111111-aaaa-4bbb-8ccc-000000000001";
const ID2 = "22222222-aaaa-4bbb-8ccc-000000000002";

const DEVICES = {
    "@odata.context": "https://graph.microsoft.com/beta/$metadata#teamwork/devices",
    value: [
        {
            id: ID1, deviceType: "teamsRoom", healthStatus: "healthy", activityState: "active", notes: null, companyAssetTag: null,
            currentUser: { id: "u-1", displayName: "Boardroom 1", userIdentityType: "aadUser" },
            hardwareDetail: { serialNumber: "SN0001", uniqueId: "uid-1", macAddresses: ["00:00:5E:00:53:01"], manufacturer: "Poly", model: "Studio X52" }
        },
        {
            id: ID2, deviceType: "collaborationBar", healthStatus: "offline", activityState: "inactive", notes: null, companyAssetTag: null,
            currentUser: { id: "u-2", displayName: "Huddle 7", userIdentityType: "aadUser" },
            hardwareDetail: { serialNumber: "SN0002", uniqueId: "uid-2", macAddresses: ["00:00:5E:00:53:02"], manufacturer: "Yealink", model: "A20" }
        }
    ]
};

const conn = (status) => ({ connection: { connectionStatus: status, lastModifiedDateTime: "2026-01-15T09:55:00Z" } });
const sw = (fresh, current) => ({ softwareFreshness: fresh, currentVersion: current, availableVersion: current });
const health = (id, p) => ({
    "@odata.context": "https://graph.microsoft.com/beta/$metadata#teamwork/devices('" + id + "')/health/$entity",
    id,
    connection: { connectionStatus: p.connection, lastModifiedDateTime: "2026-01-15T09:55:00Z" },
    loginStatus: { exchangeConnection: { connectionStatus: p.exchange }, teamsConnection: { connectionStatus: p.teams }, skypeConnection: { connectionStatus: "unknown" } },
    peripheralsHealth: {
        roomCameraHealth: Object.assign({ isOptional: false }, conn(p.camera)),
        contentCameraHealth: Object.assign({ isOptional: true }, conn("unknown")),
        speakerHealth: Object.assign({ isOptional: false }, conn(p.speaker)),
        communicationSpeakerHealth: Object.assign({ isOptional: true }, conn("unknown")),
        microphoneHealth: Object.assign({ isOptional: false }, conn(p.mic)),
        displayHealthCollection: [Object.assign({ isOptional: false }, conn(p.display))]
    },
    softwareUpdateHealth: {
        operatingSystemSoftwareUpdateStatus: sw(p.os, "10.0.19044"),
        adminAgentSoftwareUpdateStatus: sw("latest", "1.0.0.2023"),
        companyPortalSoftwareUpdateStatus: sw("latest", "11.2.1"),
        teamsClientSoftwareUpdateStatus: sw(p.teamsClient, "1449/1.0.94.2023"),
        firmwareSoftwareUpdateStatus: sw("unknown", "1.2.3"),
        partnerAgentSoftwareUpdateStatus: sw("latest", "5.0")
    },
    hardwareHealth: { computeHealth: conn(p.compute), hdmiIngestHealth: conn("unknown") }
});

const HEALTH1 = health(ID1, { connection: "connected", exchange: "connected", teams: "connected", camera: "connected", speaker: "connected", mic: "connected", display: "connected", os: "latest", teamsClient: "latest", compute: "connected" });
const HEALTH2 = health(ID2, { connection: "disconnected", exchange: "disconnected", teams: "disconnected", camera: "disconnected", speaker: "connected", mic: "disconnected", display: "disconnected", os: "updateAvailable", teamsClient: "updateAvailable", compute: "disconnected" });

const auth = { Authorization: "Bearer " + TOKEN };
const calls = () => [
    {
        kind: "http", method: "post", host: "login.microsoftonline.com", target: "/" + TENANT + "/oauth2/v2.0/token",
        reply: reply.http(200, { token_type: "Bearer", expires_in: 3599, ext_expires_in: 3599, access_token: TOKEN })
    },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: "/beta/teamwork/devices", headers: auth, reply: reply.http(200, DEVICES) },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: "/beta/teamwork/devices/" + ID1 + "/health", headers: auth, reply: reply.http(200, HEALTH1) },
    { kind: "http", method: "get", host: "graph.microsoft.com", target: "/beta/teamwork/devices/" + ID2 + "/health", headers: auth, reply: reply.http(200, HEALTH2) }
];

const parameters = (filter) => ({ tenantId: TENANT, clientId: "client-id-1", clientSecret: "client-secret-1", filterByDeviceSerialNumber: filter });

module.exports = {
    cases: [{
        name: "two devices as a table, one offline",
        parameters: parameters("false"),
        entryPoints: {
            validate: { calls: calls() },
            // The companion describes the default mode (filterByDeviceSerialNumber "true": 26 variables); "false" builds
            // a 24 column table instead, so the count check does not apply to this case.
            get_status: { calls: calls(), expect: { skipExpectedVariables: true } }
        }
    }, {
        name: "serial number filter selects one device as variables",
        parameters: parameters("true"),
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls().slice(0, 3) }
        }
    }]
};
