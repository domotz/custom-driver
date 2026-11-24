// Simulated RabbitMQ 3.12 management HTTP API replies. Shape follows the management API reference (GET /api/exchanges?page=N&page_size=M):
// { filtered_count, item_count, items: [ { name, vhost, type, durable, auto_delete, internal, arguments, message_stats { publish_in,
// publish_in_details { rate }, publish_out, confirm, return_unroutable ... } } ], page, page_count, page_size, total_count }.
// message_stats is absent on an exchange that never saw a message. The driver pages with page_size=100; the reply is split in two
// pages to exercise the paging loop.
const reply = require("../../replies");

const stat = (count, rate) => ({ [count[0]]: count[1], [count[0] + "_details"]: { rate } });
const stats = (parts) => Object.assign({}, ...parts.map(([name, count, rate]) => stat([name, count], rate)));

const PAGE1 = {
    filtered_count: 3, item_count: 2, page: 1, page_count: 2, page_size: 2, total_count: 3,
    items: [
        { name: "", vhost: "/", type: "direct", durable: true, auto_delete: false, internal: false, arguments: {} },
        {
            name: "orders", vhost: "shop", type: "topic", durable: true, auto_delete: false, internal: false, arguments: {},
            message_stats: stats([
                ["publish_in", 1500, 2.5], ["publish_out", 3000, 5], ["confirm", 1490, 2.4], ["return_unroutable", 12, 0.1]
            ])
        }
    ]
};
const PAGE2 = {
    filtered_count: 3, item_count: 1, page: 2, page_count: 2, page_size: 2, total_count: 3,
    items: [
        { name: "amq.fanout", vhost: "shop", type: "fanout", durable: true, auto_delete: false, internal: false, arguments: {}, message_stats: stats([["publish_in", 10, 0], ["publish_out", 20, 0]]) }
    ]
};

const calls = () => [
    { kind: "http", method: "get", target: "/api/exchanges?page_size=100&page=1", reply: reply.http(200, PAGE1) },
    { kind: "http", method: "get", target: "/api/exchanges?page_size=100&page=2", reply: reply.http(200, PAGE2) }
];

module.exports = {
    cases: [{
        name: "three exchanges over two pages, one with unroutable messages",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
