// Simulated Crestron DM-NVX (firmware 6.x) REST replies. Shape follows the Crestron "Device" REST API:
// POST /userlogin.html answers the web UI page and sets the session cookie, GET /Device/IpTable answers
// { Device: { IpTable: { Entries: [{ IpId, Address, ModelName, Status }] } } } with the IP ID in the
// "0x.." form. One connected device online, one offline.
const reply = require("../../replies");

const IP_TABLE = { Device: { IpTable: { Entries: [
    { IpId: "0x03", Address: "192.168.1.20", ModelName: "TSW-760", Status: "ONLINE" },
    { IpId: "0x04", Address: "192.168.1.21", ModelName: "DM-NVX-351", Status: "ONLINE" },
    { IpId: "0x05", Address: "control.lan", ModelName: "CP4-R", Status: "OFFLINE" }
] } } };

const calls = [
    { kind: "http", method: "post", target: "/userlogin.html", reply: reply.http(200, "<html><body>Crestron Device Web Interface</body></html>", { "set-cookie": ["AuthByPasswd=crypt:abc123; path=/; secure"] }) },
    { kind: "http", method: "get", target: "/Device/IpTable", reply: reply.http(200, IP_TABLE, { "content-type": "application/json" }) }
];

module.exports = {
    cases: [{
        name: "three connected devices, one offline",
        entryPoints: { validate: { calls }, get_status: { calls } }
    }]
};
