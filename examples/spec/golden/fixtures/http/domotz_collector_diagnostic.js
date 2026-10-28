// Simulated Domotz Collector 8.7.0 replies. Shape follows remote_pawn_ng src/utils/statusGenerator.js
// (GET /api/v1/status, port 3000): `diagnostic` carries the discovery counters and ignored_errors, the
// per-code counters of src/utils/diagnostic/errorCounter.js ([{ code, count }], default codes ENOSPC, EROFS,
// EACCES, EPERM, ECONNRESET).
const reply = require("../../replies");

const status = {
    status: "ok",
    mode: "configured",
    package: { full_platform: "ubuntu_core_private", agent_version: "8.7.0" },
    diagnostic: {
        iteration_counter: 1450,
        actual_discovery_counter: 1432,
        missed_discovery_counter: 18,
        ignored_errors: [
            { code: "ENOSPC", count: 0 },
            { code: "EROFS", count: 2 },
            { code: "EACCES", count: 0 },
            { code: "EPERM", count: 5 },
            { code: "ECONNRESET", count: 37 }
        ]
    }
};

const calls = () => [{ kind: "http", method: "get", target: "/api/v1/status", reply: reply.http(200, status) }];

module.exports = {
    cases: [{
        name: "collector 8.7.0",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
