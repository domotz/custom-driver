// Simulated Yealink MCore (M Core controller) replies. Shape follows the Yealink MCore central-control REST API
// the driver was written against: POST /centralcontrol/authentication { user, password } -> { status: 200,
// data: { token } }; GET /centralcontrol/system/devices -> { status: 200, data: { "device-list": [{ model,
// firmware, hardware, serialnumber, macaddress, id }] } }; GET /centralcontrol/audio/mute and
// /centralcontrol/system/status -> { status: 200, data: { status } }; GET /centralcontrol/camera/position ->
// { status: 200, data: { x, y, z } }; POST /centralcontrol/system/status { status: "reboot", sn } -> { status: 200,
// data: ... }. Member values (status words, firmware strings) are simulated: the vendor reference is not public.
// Two cases: a hub with three peripherals, audio unmuted; a hub alone (a single device), audio muted, system warning.
const reply = require("../../replies");

const TOKEN = "yl-session-token-7f3a";
const json = (body) => reply.http(200, body, { "content-type": "application/json" });
const auth = { Authorization: "Bearer " + TOKEN };

const login = { kind: "http", method: "post", protocol: "https", target: "/centralcontrol/authentication", body: /"user":"user","password":"pass"/, reply: json({ status: 200, data: { token: TOKEN } }) };
const get = (target, data) => ({ kind: "http", method: "get", protocol: "https", target, headers: auth, reply: json({ status: 200, data }) });
const reboot = (sn) => ({ kind: "http", method: "post", protocol: "https", target: "/centralcontrol/system/status", headers: auth, body: new RegExp('"sn":"' + sn + '"'), reply: json({ status: 200, data: { status: "rebooting" } }) });

const device = (id, model, firmware, hardware, sn, mac) => ({ id, model, firmware, hardware, serialnumber: sn, macaddress: mac });
const hub = device(1, "MCore Pro", "246.15.0.30", "1.0.0.0", "2506E0000001", "80:5E:C0:11:22:33");
const camera = device(2, "UVC86", "148.15.0.12", "2.0.0.0", "2506E0000002", "80:5E:C0:44:55:66");
const mic = device(3, "MSpeech", "150.15.0.8", "1.1.0.0", "2506E0000003", "80:5E:C0:77:88:99");

const entryPoints = (devices, audio, system, position) => {
    const list = get("/centralcontrol/system/devices", { "device-list": devices });
    const reads = [login, list, get("/centralcontrol/audio/mute", { status: audio }), get("/centralcontrol/system/status", { status: system }), get("/centralcontrol/camera/position", position)];
    return {
        validate: { calls: [login] },
        get_status: { calls: reads },
        custom_1: { calls: [login, list].concat(devices.map((d) => reboot(d.serialnumber))) }
    };
};

module.exports = {
    cases: [
        { name: "hub with camera and microphone", parameters: { port: 443 }, entryPoints: entryPoints([hub, camera, mic], "unmute", "normal", { x: 12, y: -30, z: 4 }) },
        { name: "single hub, muted, warning", parameters: { port: 443 }, entryPoints: entryPoints([hub], "mute", "warning", { x: 0, y: 0, z: 0 }) }
    ]
};
