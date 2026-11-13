// Simulated Domotz Box (ubuntu_core_private snap, collector 8.x) replies. Shape follows remote_pawn_ng
// src/utils/statusGenerator.js (GET /api/v1/status on port 3000: package.full_platform is the platform id
// that validate checks) and src/commands/systemRestart.js (POST /api/system-restart answers { error: null }).
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
    }
};

module.exports = {
    cases: [{
        name: "box ubuntu_core_private",
        entryPoints: {
            validate: { calls: [{ kind: "http", method: "get", target: "/api/v1/status", reply: reply.http(200, status) }] },
            get_status: { calls: [] },
            custom_1: { calls: [{ kind: "http", method: "post", target: "/api/v1/system-restart", reply: reply.http(200, { error: null }) }] }
        }
    }]
};
