// Simulated Crestron DM-NVX (firmware 6.x) REST replies. Shape follows the Crestron "Device" REST API:
// POST /userlogin.html answers the web UI page and sets the session cookie; GET /Device/DeviceInfo,
// /Device/SystemVersions, /Device/DeviceSpecific, /Device/StreamReceive and /Device/StreamTransmit answer
// { Device: { <Section>: {...} } }. Two cases: a Transmitter (two streams) and a Receiver (one stream
// locked, one without a source).
const reply = require("../../replies");

const json = (body) => reply.http(200, body, { "content-type": "application/json" });
const login = { kind: "http", method: "post", target: "/userlogin.html", reply: reply.http(200, "<html><body>Crestron Device Web Interface</body></html>", { "set-cookie": ["AuthByPasswd=crypt:abc123; path=/; secure"] }) };

const deviceInfo = (name, model, serial) => ({ Device: { DeviceInfo: {
    Name: name, Model: model, Category: "DM-NVX", Manufacturer: "Crestron", ModelId: "0x4D2", SerialNumber: serial,
    BuildDate: "March 04 2024 (439842)", DeviceId: "@E-00107f8a1b2c", MacAddress: "00.10.7f.8a.1b.2c"
} } });
const versions = { Device: { SystemVersions: { Version: "6.5001.00019" } } };
const mode = (m) => ({ Device: { DeviceSpecific: { DeviceMode: m, ActiveVideoSource: "Input1" } } });

const TRANSMIT = { Device: { StreamTransmit: { Streams: [
    { Name: "Stream1", MulticastAddress: "239.8.0.10", StreamLocation: "rtsp://192.168.1.50:554/live/1/stream.sdp", ActiveBitrate: 14, HorizontalResolution: 1920, VerticalResolution: 1080 },
    { Name: "Stream2", MulticastAddress: "239.8.0.11", StreamLocation: "rtsp://192.168.1.50:554/live/2/stream.sdp", ActiveBitrate: 0, HorizontalResolution: 0, VerticalResolution: 0 }
] } } };
const RECEIVE = { Device: { StreamReceive: { Streams: [
    { Name: "Stream1", MulticastAddress: "239.8.0.10", InitiatorAddress: "192.168.1.50", HorizontalResolution: 1920, VerticalResolution: 1080 },
    { Name: "Stream2", MulticastAddress: "239.8.0.99", InitiatorAddress: "", HorizontalResolution: 0, VerticalResolution: 0 }
] } } };

const get = (target, body) => ({ kind: "http", method: "get", target, reply: json(body) });
const transmitter = [login, get("/Device/DeviceSpecific", mode("Transmitter")), get("/Device/StreamTransmit", TRANSMIT),
    get("/Device/SystemVersions", versions), get("/Device/DeviceInfo", deviceInfo("NVX-Lobby-TX", "DM-NVX-351", "2218UBH00123"))];
const receiver = [login, get("/Device/DeviceSpecific", mode("Receiver")), get("/Device/StreamReceive", RECEIVE),
    get("/Device/SystemVersions", versions), get("/Device/DeviceInfo", deviceInfo("NVX-Lobby-RX", "DM-NVX-351", "2218UBH00456"))];

module.exports = {
    cases: [
        { name: "transmitter", entryPoints: { validate: { calls: transmitter }, get_status: { calls: transmitter } } },
        { name: "receiver", entryPoints: { validate: { calls: receiver }, get_status: { calls: receiver } } }
    ]
};
