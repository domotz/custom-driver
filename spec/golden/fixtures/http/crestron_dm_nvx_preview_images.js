// Simulated Crestron DM-NVX (firmware 6.x) REST replies. Shape follows the Crestron "Device" REST API:
// POST /userlogin.html answers the web UI page and sets the session cookie; GET /Device/Preview answers
// { Device: { Preview: { ImageList: [{ Name, FQDNPath, IPv4Path, IsImageAvailable, Size (bytes), Height, Width }] } } }.
// The device offers several preview sizes; one of them (the 1080p one) is not generated while the input is idle.
// This driver has no companion .json, so no expected_variables are checked.
const reply = require("../../replies");

const login = { kind: "http", method: "post", target: "/userlogin.html", reply: reply.http(200, "<html><body>Crestron Device Web Interface</body></html>", { "set-cookie": ["AuthByPasswd=crypt:abc123; path=/; secure"] }) };

const image = (name, available, size, width, height) => ({
    Name: name, FQDNPath: "https://nvx-lobby-tx.example.com/preview/" + name + ".jpg", IPv4Path: "https://192.168.1.50/preview/" + name + ".jpg",
    IsImageAvailable: available, Size: size, Height: height, Width: width
});

const PREVIEW = { Device: { Preview: { ImageList: [
    image("Image1_320x180", true, 8214, 320, 180),
    image("Image2_640x360", true, 21980, 640, 360),
    image("Image3_1920x1080", false, 0, 1920, 1080)
] } } };

const calls = () => [login, { kind: "http", method: "get", target: "/Device/Preview", reply: reply.http(200, PREVIEW, { "content-type": "application/json" }) }];

module.exports = {
    cases: [{ name: "transmitter with three preview sizes", entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } } }]
};
