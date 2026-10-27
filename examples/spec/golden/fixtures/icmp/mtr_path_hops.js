// Simulated D.device.mtr replies. Shape follows the sandbox documentation of D.device.mtr
// (remote_pawn_ng src/sandbox/library/device.js): { target, protocol, cycles, packet_size, hop_count, elapsed_ms,
// hops[] } with rtt { last, avg, best, worst, stddev } and jitter { last, avg, max, interval } per hop, null on a blind hop.
const reply = require("../../replies");

const hop = (ttl, host, hostname, loss, sent, rtt, jit) => ({
    ttl, host, hostname, hosts: host ? [{ ip: host, hostname }] : [],
    loss_percent: loss, sent, received: Math.round(sent * (100 - loss) / 100), dropped: Math.round(sent * loss / 100),
    rtt: rtt ? { last: rtt + 0.4, avg: rtt, best: rtt - 0.6, worst: rtt + 2.1, stddev: 0.7 } : null,
    jitter: jit ? { last: jit, avg: jit, max: jit * 2, interval: jit } : null,
    tos: host ? 0 : null, extensions: null
});

// 10 cycles; hop 3 does not answer (typical ICMP rate limiting), hop 4 answers; destination lossy.
const RESULT = {
    target: "192.168.1.50", protocol: "ICMP", cycles: 10, packet_size: 84, hop_count: 4, elapsed_ms: 10420,
    hops: [
        hop(1, "192.168.1.1", "gateway.lan", 0, 10, 0.8, 0.2),
        hop(2, "10.20.0.1", null, 0, 10, 2.4, 0.5),
        hop(3, null, null, 100, 10, null, null),
        hop(4, "192.168.1.50", "nas.lan", 10, 10, 3.9, 1.3)
    ]
};

const call = () => ({ kind: "mtr", method: "mtr", reply: reply.mtr(RESULT) });

module.exports = {
    cases: [{
        name: "path with a blind hop and a lossy destination",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
