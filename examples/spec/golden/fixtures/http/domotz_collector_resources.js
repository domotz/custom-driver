// Simulated Domotz Collector 8.7.0 replies. Shape follows remote_pawn_ng src/utils/statusGenerator.js
// (GET /api/v1/status, port 3000): uptime in seconds (os.uptime / process.uptime, process one fractional),
// loadavg = os.loadavg() floats, freemem = os.freemem() in bytes.
const reply = require("../../replies");

const status = {
    status: "ok",
    mode: "configured",
    package: {
        pkg_platform: "ubuntu_core",
        pkg_architecture: "arm64",
        full_platform: "ubuntu_core_private",
        agent_version: "8.7.0",
        node_version: "v20.18.1"
    },
    uptime: { system: 1209600.45, process: 86400.123 },
    loadavg: [0.52, 0.47, 0.41],
    freemem: 1843200000
};

const calls = () => [{ kind: "http", method: "get", target: "/api/v1/status", reply: reply.http(200, status) }];

module.exports = {
    cases: [{
        name: "collector 8.7.0",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
