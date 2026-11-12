// Simulated RabbitMQ 3.12 management HTTP API replies. Shape follows the management API reference: GET /api/overview
// ({ management_version, rabbitmq_version, erlang_version, cluster_name, message_stats { publish, publish_details { rate }, confirm,
// deliver_get, ack, redeliver, return_unroutable ... }, queue_totals { messages, messages_ready, messages_unacknowledged },
// object_totals { channels, connections, consumers, exchanges, queues } }), GET /api/nodes and /api/nodes/{name}?memory=true
// (name, running, mem_used, mem_limit, mem_alarm, disk_free, disk_free_limit, disk_free_alarm, fd_used, sockets_used, sockets_total,
// run_queue, uptime in ms, partitions) and the health check endpoints GET /api/health/checks/<check> which answer {"status":"ok"} with
// HTTP 200 when the check passes (a failing check answers HTTP 503, which the driver reports as a failure). The node reports one
// network partition (the node is still up, so every health check stays ok).
const reply = require("../../replies");

const rate = (r) => ({ rate: r });
const OVERVIEW = {
    management_version: "3.12.10",
    rabbitmq_version: "3.12.10",
    erlang_version: "26.1.2",
    cluster_name: "rabbit@rmq-1",
    node: "rabbit@rmq-1",
    message_stats: {
        publish: 120000, publish_details: rate(25.5),
        publish_in: 120000, publish_in_details: rate(25.5),
        publish_out: 240000, publish_out_details: rate(50.25),
        confirm: 119900, confirm_details: rate(25.4),
        deliver_get: 239000, deliver_get_details: rate(49.5),
        ack: 238900, ack_details: rate(49.4),
        redeliver: 15, redeliver_details: rate(0.1),
        return_unroutable: 30, return_unroutable_details: rate(0)
    },
    queue_totals: { messages: 15025, messages_details: rate(2.9), messages_ready: 15020, messages_ready_details: rate(2.7), messages_unacknowledged: 5, messages_unacknowledged_details: rate(0.2) },
    object_totals: { channels: 18, connections: 12, consumers: 9, exchanges: 14, queues: 7 }
};
const NODE = {
    name: "rabbit@rmq-1", type: "disc", running: true,
    mem_used: 190000000, mem_limit: 3300000000, mem_alarm: false,
    disk_free: 48000000000, disk_free_limit: 50000000, disk_free_alarm: false,
    fd_used: 55, fd_total: 1048576, sockets_used: 20, sockets_total: 943626, run_queue: 1,
    uptime: 90061000, partitions: ["rabbit@rmq-2"]
};
const ok = { status: "ok" };

const get = (target, body) => ({ kind: "http", method: "get", target, reply: reply.http(200, body) });
const checks = () => [
    get("/api/overview", OVERVIEW),
    get("/api/health/checks/alarms", ok),
    get("/api/health/checks/node-is-mirror-sync-critical", ok),
    get("/api/health/checks/certificate-expiration/1/months", ok),
    get("/api/health/checks/local-alarms", ok),
    get("/api/health/checks/node-is-quorum-critical", ok),
    get("/api/health/checks/virtual-hosts", ok)
];

module.exports = {
    cases: [{
        name: "running node with one network partition, all health checks ok",
        entryPoints: {
            validate: { calls: checks() },
            get_status: {
                calls: checks().concat([
                    get("/api/nodes/", [NODE, Object.assign({}, NODE, { name: "rabbit@rmq-2" })]),
                    get("/api/nodes/rabbit@rmq-1?memory=true", Object.assign({}, NODE, { memory: { total: { rss: 190000000 } } }))
                ])
            }
        }
    }]
};
