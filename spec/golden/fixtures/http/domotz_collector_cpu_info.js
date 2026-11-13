// Simulated Domotz Collector 8.7.0 replies. Shape follows remote_pawn_ng src/utils/statusGenerator.js
// (GET /api/v1/status, port 3000): cpus = Node os.cpus() entries { model, speed (MHz), times { user, nice,
// sys, idle, irq } } with times in MILLISECONDS, as Node documents.
const reply = require("../../replies");

const cpu = (model, speed, user, nice, sys, idle, irq) => ({ model, speed, times: { user, nice, sys, idle, irq } });

const status = {
    status: "ok",
    mode: "configured",
    cpus: [
        cpu("Intel(R) Celeron(R) N5105 @ 2.00GHz", 2000, 1523400, 1200, 612300, 83420100, 0),
        cpu("Intel(R) Celeron(R) N5105 @ 2.00GHz", 2900, 1498800, 900, 601500, 83510200, 0),
        cpu("Intel(R) Celeron(R) N5105 @ 2.00GHz", 1800, 1610000, 0, 700200, 83200000, 4500),
        cpu("Intel(R) Celeron(R) N5105 @ 2.00GHz", 2000, 1475100, 300, 590000, 83600900, 0)
    ]
};

const calls = () => [{ kind: "http", method: "get", target: "/api/v1/status", reply: reply.http(200, status) }];

module.exports = {
    cases: [{
        name: "collector 4 cores",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
