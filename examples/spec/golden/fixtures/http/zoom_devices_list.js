// Simulated Zoom API v2 replies. Shape follows the Zoom Server-to-Server OAuth token reply (POST zoom.us/oauth/token:
// access_token, token_type "bearer", expires_in, scope) and "List devices" (GET api.zoom.us/v2/devices):
// { next_page_token, page_size, devices: [{ device_id, device_name, room_id, room_name, serial_number, vendor,
// model, platform_os, app_version, tag, enrolled_in_zdm, connected_to_zdm, device_type, device_status,
// last_online }] } with device_type / device_status as the integer codes of the API reference.
const reply = require("../../replies");

const TOKEN = "eyJzdiI6IjAwMDAwMSIsImFsZyI6IkhTNTEyIn0.zoom-token";

const devices = {
    next_page_token: "",
    page_size: 30,
    devices: [
        {
            device_id: "dev_AbC123", device_name: "Boardroom Controller", mac_address: "00:1B:44:11:3A:B7",
            serial_number: "SN-ZR-0001", vendor: "Logitech", model: "Tap IP", platform_os: "Linux",
            app_version: "6.2.0.4118", tag: "HQ", enrolled_in_zdm: true, connected_to_zdm: true,
            room_id: "room_001", room_name: "Boardroom", device_type: 1, device_status: 1,
            last_online: "2024-05-07T08:09:10Z"
        },
        {
            device_id: "dev_DeF456", device_name: "Huddle Computer", mac_address: "00:1B:44:11:3A:B8",
            serial_number: "SN-ZR-0002", vendor: "Dell", model: "OptiPlex 7090", platform_os: "Windows 11",
            app_version: "6.1.5.2211", tag: "Branch", enrolled_in_zdm: false, connected_to_zdm: false,
            room_id: "room_002", room_name: "Huddle 2", device_type: 0, device_status: 0,
            last_online: "2024-04-30T23:59:01Z"
        }
    ]
};

const calls = () => [
    {
        kind: "http", method: "post", host: "zoom.us", target: "/oauth/token",
        headers: { Authorization: "Basic Y2xpZW50LWlkOmNsaWVudC1zZWNyZXQ=" },
        reply: reply.http(200, { access_token: TOKEN, token_type: "bearer", expires_in: 3599, scope: "zoom_rooms:read:list_devices:admin" })
    },
    {
        kind: "http", method: "get", host: "api.zoom.us", target: "/v2/devices?device_status=2&page_size=30",
        headers: { Authorization: "Bearer " + TOKEN },
        reply: reply.http(200, devices)
    }
];

module.exports = {
    cases: [{
        name: "one online controller, one offline computer",
        parameters: { accountId: "acc123", clientId: "client-id", clientSecret: "client-secret", deviceId: ["all"], deviceType: ["all"], roomName: ["all"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
