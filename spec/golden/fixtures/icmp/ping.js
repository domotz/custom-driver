// Simulated D.device.ping reply. Shape follows network_tools/latency/ping.js as cited in spec/net/scenarios.js:
// { jitter, avg, packet_loss, min, max, std, samples } (ms, packet_loss in %).
const reply = require("../../replies");

module.exports = {
    cases: [{
        name: "ten probes, one lost",
        entryPoints: {
            validate: { calls: [] },
            get_status: {
                calls: [{
                    kind: "ping", method: "ping",
                    reply: reply.ping({
                        jitter: 0.8, avg: 4.2, packet_loss: 10, min: 2.9, max: 7.5, std: 1.4,
                        samples: [3.1, 4.0, 2.9, 5.2, 4.4, 3.8, 7.5, 4.1, 3.6]
                    })
                }]
            }
        }
    }]
};
