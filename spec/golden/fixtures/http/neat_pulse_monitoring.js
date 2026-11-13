// Simulated Neat Pulse cloud API replies (api.pulse.neat.no, Bearer token). Shape follows the Neat Pulse REST API
// the driver was written against: GET /v1/orgs/<org>/regions, GET /v1/orgs/<org>/endpoints -> { endpoints: [{ id,
// serial, ... }] }, GET /v1/orgs/<org>/endpoints/<id> -> the endpoint (serial, model, connected, upgradeStatus,
// firmwareVersion, latestVersion, roomName, pairingSerial, localIpAddress, inCallStatus,
// hasScheduledFirmwareUpdate, otaChannel, primaryMode, total/free System/Internal/External storage in bytes,
// automaticUpdates, firmware(Version|latestVersion) release names, isLatestVersionScheduledForNow, timezone),
// GET .../sensor -> { endpointData: { data: [{ temp, humidity, co2, voc, vocIndex, illumination, people }],
// shutterClosed } } and POST .../reboot. Field names that the vendor reference does not spell out are simulated
// from the driver's reading.
// Cases: device id given as a parameter; device found in the inventory by serial (the fake device serial is
// SN0001, no external storage, dark room); serial missing from the inventory (a single message
// variable, so the 35 expected variables do not apply).
const reply = require("../../replies");

const HOST = "api.pulse.neat.no";
const ORG = "org-4711";
const KEY = "neat-token";
const GB = 1024 * 1024 * 1024;

const json = (body) => reply.http(200, body, { "content-type": "application/json" });
const call = (method, target, body) => ({ kind: "http", method, host: HOST, protocol: "https", target, headers: { Authorization: "Bearer " + KEY }, reply: json(body) });
const get = (target, body) => call("get", target, body);

const endpoint = (over) => Object.assign({
    id: "ep-0001", serial: "SN0001", model: "Neat Bar Gen 2", connected: true, upgradeStatus: "UP_TO_DATE", firmwareVersion: "25.10.2", latestVersion: "25.10.2",
    roomName: "Boardroom", pairingSerial: "PD0001", localIpAddress: "192.0.2.10", inCallStatus: "NOT_IN_CALL", hasScheduledFirmwareUpdate: false,
    otaChannel: "stable", primaryMode: "ZOOM", totalSystemStorage: 12 * GB, freeSystemStorage: 7 * GB, totalInternalStorage: 64 * GB, freeInternalStorage: 48.5 * GB,
    totalExternalStorage: 32 * GB, freeExternalStorage: 30 * GB, automaticUpdates: true, firmwareVersionReleaseName: "Oct 2025", latestVersionReleaseName: "Oct 2025",
    isLatestVersionScheduledForNow: false, timezone: "Europe/Rome"
}, over);
const sensor = (data, shutterClosed) => ({ endpointData: { data: [data], shutterClosed } });
const room = sensor({ temp: 22.4, humidity: 41, co2: 612, voc: 130, vocIndex: 85, illumination: 340, people: 3 }, false);
const darkRoom = sensor({ temp: 19.8, humidity: 55, co2: 480, voc: 90, vocIndex: 40, illumination: 0, people: 0 }, true);

const base = "/v1/orgs/" + ORG;
const regions = get(base + "/regions", { regions: [{ id: "eu", name: "Europe" }] });
const inventory = (endpoints) => get(base + "/endpoints", { endpoints });
const reboot = (id) => call("post", base + "/endpoints/" + id + "/reboot", {});

module.exports = {
    cases: [
        {
            name: "device id given",
            parameters: { neatAPIKey: KEY, neatOrgID: ORG, cloudControllerDeviceID: "ep-0001" },
            entryPoints: {
                validate: { calls: [regions] },
                get_status: { calls: [get(base + "/endpoints/ep-0001", endpoint({ inCallStatus: "IN_CALL", upgradeStatus: "UPDATE_AVAILABLE", latestVersion: "25.11.0", latestVersionReleaseName: "Nov 2025" })), get(base + "/endpoints/ep-0001/sensor", room)] },
                custom_1: { calls: [reboot("ep-0001")] }
            }
        },
        {
            name: "device found by serial",
            parameters: { neatAPIKey: KEY, neatOrgID: ORG, cloudControllerDeviceID: "" },
            entryPoints: {
                validate: { calls: [regions] },
                get_status: {
                    calls: [
                        inventory([{ id: "ep-0099", serial: "SN9999" }, { id: "ep-0002", serial: "SN0001" }]),
                        get(base + "/endpoints/ep-0002", endpoint({ id: "ep-0002", roomName: "Huddle 4", model: "Neat Board 50", totalExternalStorage: 0, freeExternalStorage: 0 })),
                        get(base + "/endpoints/ep-0002/sensor", darkRoom)
                    ]
                },
                custom_1: { calls: [inventory([{ id: "ep-0099", serial: "SN9999" }, { id: "ep-0002", serial: "SN0001" }]), reboot("ep-0002")] }
            }
        },
        {
            name: "serial not in the inventory",
            parameters: { neatAPIKey: KEY, neatOrgID: ORG, cloudControllerDeviceID: "   " },
            entryPoints: {
                validate: { calls: [regions] },
                get_status: { calls: [inventory([{ id: "ep-0099", serial: "SN9999" }])], expect: { /* the driver publishes only a "Message" variable here */ skipExpectedVariables: true } },
                custom_1: { calls: [inventory([{ id: "ep-0099", serial: "SN9999" }])], expect: { skipExpectedVariables: true } }
            }
        }
    ]
};
