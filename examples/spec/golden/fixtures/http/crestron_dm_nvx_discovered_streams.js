// Simulated Crestron DM-NVX (firmware 6.x) REST replies. Shape follows the Crestron "Device" REST API:
// POST /userlogin.html answers the web UI page and sets the session cookie, GET /Device/DiscoveredStreams
// answers { Device: { DiscoveredStreams: { Streams: { <uuid>: { UniqueId, SessionName, Bitrate, Resolution,
// MulticastAddress } } } } }.
const reply = require("../../replies");

const STREAMS = { Device: { DiscoveredStreams: { Streams: {
    "6b1f0a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b": { UniqueId: "6b1f0a2e-3c4d-4e5f-8a9b-0c1d2e3f4a5b", SessionName: "Lobby Display", Bitrate: "14", Resolution: "1920x1080", MulticastAddress: "239.8.0.10" },
    "9c2d1b3a-4e5f-4a6b-9c8d-1e2f3a4b5c6d": { UniqueId: "9c2d1b3a-4e5f-4a6b-9c8d-1e2f3a4b5c6d", SessionName: "Boardroom Camera", Bitrate: "6", Resolution: "1280x720", MulticastAddress: "239.8.0.11" }
} } } };

const calls = [
    { kind: "http", method: "post", target: "/userlogin.html", reply: reply.http(200, "<html><body>Crestron Device Web Interface</body></html>", { "set-cookie": ["AuthByPasswd=crypt:abc123; path=/; secure"] }) },
    { kind: "http", method: "get", target: "/Device/DiscoveredStreams", reply: reply.http(200, STREAMS, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "two discovered streams",
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
