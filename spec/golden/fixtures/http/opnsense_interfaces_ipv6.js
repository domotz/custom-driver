// Simulated OPNsense 23.7 replies. Shape follows the OPNsense API reference (diagnostics/firewall): GET
// /api/diagnostics/firewall/pf_statistics/interfaces returns { interfaces: { <name>: { references, in6_pass_bytes,
// in6_block_bytes, out6_pass_bytes, out6_block_bytes, ..., cleared } } } with an "all" aggregate; cleared is the
// pfctl text timestamp ("Mon Jan 12 08:00:00 2026").
const reply = require("../../replies");

const iface = (references, in6Pass, in6Block, out6Pass, out6Block) => ({
    references, cleared: "Mon Jan 12 08:00:00 2026",
    in6_pass_packets: Math.round(in6Pass / 900), in6_pass_bytes: in6Pass,
    in6_block_packets: Math.round(in6Block / 60), in6_block_bytes: in6Block,
    out6_pass_packets: Math.round(out6Pass / 900), out6_pass_bytes: out6Pass,
    out6_block_packets: Math.round(out6Block / 60), out6_block_bytes: out6Block
});

const STATS = {
    interfaces: {
        all: iface(0, 3810450000, 604800, 2103220000, 0),
        em0: iface(3, 2421300000, 604800, 1980000000, 0),
        em1: iface(1, 1389150000, 0, 123220000, 7200),
        lo0: iface(0, 0, 0, 0, 0)
    }
};

function calls() {
    return [{ kind: "http", method: "get", target: "/api/diagnostics/firewall/pf_statistics/interfaces", reply: reply.http(200, STATS, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "opnsense 23.7 all interfaces",
        parameters: { interfaceName: ["ALL"], portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }, {
        name: "opnsense 23.7 em interfaces",
        parameters: { interfaceName: ["em"], portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
