// Simulated ClearOne Convergence 3.1.0.0 replies. The Convergence dashboard API is not publicly documented; the
// shape follows the dashboard back end the driver was written against: GET
// /dashboard-back/api/devices/pro-audio/search?q=<ip> answers { avDevices: [{ id, productModel, serialNumber,
// firmwareVersion, hasNewFirmware, locateMode, relativeStatus ("ONLINE - 3 days"), location, ... }] } and
// GET /dashboard-back/api/devices/pro-audio/<id> answers the device detail with partNumber. The driver reads the
// Convergence server from the "urlCl" parameter (both cases give a port: without one the driver keeps the
// "http://" prefix in the host name, clearone_convergence.js lines 33-41, and no call can succeed) and sends the API key (the device password) in X-Api-Key.
const reply = require("../../replies");

const HOST = "convergence.example.com";
const json = (body) => reply.http(200, body, { "content-type": "application/json" });
const search = (device) => ({ kind: "http", method: "get", host: HOST, target: "/dashboard-back/api/devices/pro-audio/search?q=192.0.2.10", headers: { "X-Api-Key": "pass" }, reply: json({ avDevices: [device] }) });
const detail = (id, partNumber) => ({ kind: "http", method: "get", host: HOST, target: "/dashboard-back/api/devices/pro-audio/" + id, headers: { "X-Api-Key": "pass" }, reply: json({ id, partNumber, name: "CONVERGE Pro 2" }) });

const online = { id: "7f3b2a10", productModel: "CONVERGE Pro 2 128", serialNumber: "C2P128A00417", firmwareVersion: "3.1.0.0", hasNewFirmware: false, locateMode: false, relativeStatus: "ONLINE - 3 days", location: "Boardroom" };
const offline = { id: "9c1d4e22", productModel: "CONVERGE Pro 2 128", serialNumber: "C2P128A00552", firmwareVersion: "3.0.2.1", hasNewFirmware: true, locateMode: true, relativeStatus: "OFFLINE - 4 hours", location: "Training room" };

module.exports = {
    cases: [
        {
            name: "online device, firmware current",
            parameters: { urlCl: "http://" + HOST + ":8080" },
            entryPoints: { validate: { calls: [search(online)] }, get_status: { calls: [search(online), detail(online.id, "910-3200-006")] } }
        },
        {
            name: "offline device in locate mode with new firmware pending",
            parameters: { urlCl: "http://" + HOST + ":8081" },
            entryPoints: { validate: { calls: [search(offline)] }, get_status: { calls: [search(offline), detail(offline.id, "910-3200-006")] } }
        }
    ]
};
