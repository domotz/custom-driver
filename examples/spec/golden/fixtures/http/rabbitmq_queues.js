// Simulated RabbitMQ 3.12 management HTTP API replies. Shape follows the management API reference (GET /api/queues?page=N&page_size=M):
// { filtered_count, item_count, items: [ { name, vhost, durable, state, consumers, memory, messages, messages_details { rate },
// messages_ready, messages_ready_details, messages_unacknowledged, messages_unacknowledged_details, message_stats { publish, deliver,
// deliver_get, ack, redeliver and their *_details { rate } } } ], page, page_count, page_size, total_count }. An idle queue has no
// message_stats. The reply is split in two pages (page_size=100 is what the driver sends) to exercise the paging loop.
const reply = require("../../replies");

const d = (rate) => ({ rate });
const PAGE1 = {
    filtered_count: 3, item_count: 2, page: 1, page_count: 2, page_size: 2, total_count: 3,
    items: [
        {
            name: "orders.new", vhost: "shop", durable: true, state: "running", consumers: 3, memory: 55248,
            messages: 25, messages_details: d(0.4), messages_ready: 20, messages_ready_details: d(0.2), messages_unacknowledged: 5, messages_unacknowledged_details: d(0.2),
            message_stats: {
                publish: 5000, publish_details: d(10.5), deliver: 4975, deliver_details: d(10.1), deliver_get: 4975, deliver_get_details: d(10.1),
                ack: 4970, ack_details: d(10), redeliver: 3, redeliver_details: d(0.05)
            }
        },
        {
            name: "orders.dead", vhost: "shop", durable: true, state: "running", consumers: 0, memory: 1250000,
            messages: 15000, messages_details: d(2.5), messages_ready: 15000, messages_ready_details: d(2.5), messages_unacknowledged: 0, messages_unacknowledged_details: d(0),
            message_stats: { publish: 15000, publish_details: d(2.5) }
        }
    ]
};
const PAGE2 = {
    filtered_count: 3, item_count: 1, page: 2, page_count: 2, page_size: 2, total_count: 3,
    items: [
        { name: "audit", vhost: "/", durable: false, state: "running", consumers: 1, memory: 21000, messages: 0, messages_ready: 0, messages_unacknowledged: 0 }
    ]
};

const calls = () => [
    { kind: "http", method: "get", target: "/api/queues?page_size=100&page=1", reply: reply.http(200, PAGE1) },
    { kind: "http", method: "get", target: "/api/queues?page_size=100&page=2", reply: reply.http(200, PAGE2) }
];

module.exports = {
    cases: [{
        name: "three queues over two pages, one backlog without consumers",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
