// Simulated Philips Hue Bridge (API v1) replies. Shape follows the Hue v1 "Get all lights" call,
// GET /api/<username>/lights: an object keyed by light id, each { state: { on, bri (1-254), hue, sat, ... },
// swupdate: { state: "noupdates" | "readytoinstall" | ..., lastinstall }, type, name, modelid,
// manufacturername, uniqueid, swversion }. The driver takes the bridge "username" from the device password.
const reply = require("../../replies");

const light = (name, on, bri, swversion, swupdate) => ({
    state: { on, bri, hue: 8418, sat: 140, effect: "none", xy: [0.4573, 0.41], ct: 366, alert: "select", colormode: "ct", mode: "homeautomation", reachable: true },
    swupdate: { state: swupdate, lastinstall: "2024-03-12T09:41:00" },
    type: "Extended color light", name, modelid: "LCT015", manufacturername: "Signify Netherlands B.V.", productname: "Hue color lamp",
    uniqueid: "00:17:88:01:0" + name.length + ":aa:bb:cc-0b", swversion
});

const LIGHTS = {
    1: light("Living room 1", true, 254, "1.108.9", "noupdates"),
    2: light("Kitchen", false, 1, "1.104.2", "readytoinstall")
};

const calls = () => [{ kind: "http", method: "get", target: "/api/pass/lights", protocol: "https", reply: reply.http(200, LIGHTS) }];

module.exports = {
    cases: [{
        name: "hue bridge with two lights",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
