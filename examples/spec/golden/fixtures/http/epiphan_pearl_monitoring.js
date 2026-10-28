// Simulated Epiphan Pearl-2 (firmware 4.24) replies. Shape follows the Epiphan Pearl REST API v2.0: every
// resource answers { status: "ok", result: {...} } (basic auth, HTTPS). /system/ident -> { name, location,
// description }, /system/firmware -> { product_name, version, revision, product_id }, /system/status -> { uptime
// (s), cpuload (%), cputemp (C) }, /system/connectivity/details -> { external_ip, dns, http, https, mdns },
// /system/storages/main/status -> { state, total, free } (bytes); the control endpoints answer { status: "ok" }.
// The member names of connectivity/details and storages/main/status are simulated from the driver's reading
// (the vendor reference lists the resources but not every field).
const reply = require("../../replies");

const ok = (result) => reply.http(200, { status: "ok", result }, { "content-type": "application/json" });
const get = (target, result) => ({ kind: "http", method: "get", target, protocol: "https", headers: {}, reply: ok(result) });
const post = (target) => ({ kind: "http", method: "post", target, protocol: "https", reply: reply.http(200, { status: "ok" }, { "content-type": "application/json" }) });

const GB = 1024 * 1024 * 1024;
const readCalls = (ident, firmware, status, connectivity, storage) => [
    get("/api/v2.0/system/ident", ident),
    get("/api/v2.0/system/firmware", firmware),
    get("/api/v2.0/system/status", status),
    get("/api/v2.0/system/connectivity/details", connectivity),
    get("/api/v2.0/system/storages/main/status", storage)
];

const actions = () => ({
    custom_1: { calls: [post("/api/v2.0/recorders/1/control/stop")] },
    custom_2: { calls: [post("/api/v2.0/recorders/1/control/start")] },
    custom_3: { calls: [post("/api/v2.0/channels/1/publishers/control/stop")] },
    custom_4: { calls: [post("/api/v2.0/channels/1/publishers/control/start")] },
    custom_5: { calls: [post("/api/v2.0/system/singletouchcontrol/0/control/toggle")] },
    custom_6: { calls: [post("/api/v2.0/system/presets/Default/control/apply")] },
    custom_7: { calls: [post("/api/v2.0/system/control/reboot")] }
});

const entryPoints = (calls) => Object.assign({
    validate: { calls: [calls[0]] },
    get_status: { calls }
}, actions());

const params = { httpsPort: 443 };

module.exports = {
    cases: [
        {
            name: "healthy pearl-2",
            parameters: params,
            entryPoints: entryPoints(readCalls(
                { name: "Studio A Pearl", location: "Lecture hall 2", description: "Main lecture capture" },
                { product_name: "Pearl-2", version: "4.24.1", revision: "7d1f2c9", product_id: 3 },
                { uptime: 1209600, cpuload: 23, cputemp: 58 },
                { external_ip: "203.0.113.45", dns: "ok", http: "ok", https: "ok", mdns: "studio-a-pearl.local" },
                { state: "ok", total: 500 * GB, free: 350 * GB }
            ))
        },
        {
            name: "hot pearl with almost full storage",
            parameters: params,
            entryPoints: entryPoints(readCalls(
                { name: "Studio B Pearl", location: "Room 14", description: "Overflow room" },
                { product_name: "Pearl Mini", version: "4.22.0", revision: "a93e0b1", product_id: 5 },
                { uptime: 86400, cpuload: 91, cputemp: 83 },
                { external_ip: "198.51.100.7", dns: "failed", http: "ok", https: "ok", mdns: "studio-b-pearl.local" },
                { state: "full", total: 250 * GB, free: 2 * GB }
            ))
        }
    ]
};
