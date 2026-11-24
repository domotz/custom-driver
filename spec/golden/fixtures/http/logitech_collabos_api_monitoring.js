// Simulated Logitech Rally Bar (CollabOS 1.15) replies. Shape follows the CollabOS local REST API envelope
// { code, result }: POST /api/v1/signin returns result.auth_token, GET /api/v1/device, /insights/device,
// /insights/room and /peripherals return result objects; the Authorization Bearer header carries the token.
const reply = require("../../replies");

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.rally-bar-token";
const AUTH = { Authorization: "Bearer " + TOKEN };
const ok = (result) => reply.http(200, { code: 200, result });

const signin = () => ({
    kind: "http", method: "post", target: "/api/v1/signin",
    body: /^\{"username":".*","password":".*"\}$/,
    reply: ok({ auth_token: TOKEN })
});

const device = {
    collabOSVersion: "1.15.3",
    deviceConfiguration: "RallyBar",
    ethernetMAC: "00:1F:C6:AA:10:01",
    hwVersion: "A.1",
    modelName: "Rally Bar",
    serialNumber: "2214LZ0A1B2C",
    systemName: "Boardroom",
    wifiMAC: "00:1F:C6:AA:10:02",
    deviceName: "rallybar-boardroom",
    serviceProvider: "Zoom"
};

const deviceInsights = {
    deviceState: "InCall",
    micState: "Unmuted",
    speakerState: "Unmuted",
    speakerMaxVolume: 100,
    speakerVolume: 42
};

const roomInsights = {
    peopleCount: 6,
    occupancy: { detected: true, confidence: 0.92 },
    temperature: 22.5
};

const peripherals = {
    cameras: [
        { name: "Rally Camera", connected: true, firmware: "1.4.2" },
        { name: "Rally Camera 2", connected: false, firmware: "1.4.2" }
    ]
};

const dataCalls = () => [
    { kind: "http", method: "get", target: "/api/v1/device", headers: AUTH, reply: ok(device) },
    { kind: "http", method: "get", target: "/api/v1/insights/device", headers: AUTH, reply: ok(deviceInsights) },
    { kind: "http", method: "get", target: "/api/v1/peripherals", headers: AUTH, reply: ok(peripherals) },
    { kind: "http", method: "get", target: "/api/v1/insights/room", headers: AUTH, reply: ok(roomInsights) }
];

module.exports = {
    cases: [{
        name: "rally bar collabos 1.15.3",
        entryPoints: {
            validate: { calls: [signin()] },
            get_status: { calls: [signin()].concat(dataCalls()) }
        }
    }]
};
