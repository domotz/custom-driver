// Simulated OPNsense 23.7 replies. Shape follows the OPNsense API reference (diagnostics/firewall): GET
// /api/diagnostics/firewall/pf_statistics/interfaces returns { interfaces: { <name>: { references, in4_pass_packets,
// in4_pass_bytes, in4_block_bytes, out4_pass_bytes, out4_block_bytes, ..., cleared } } } with an "all" aggregate;
// cleared is the pfctl text timestamp ("Mon Jan 12 08:00:00 2026").
const reply = require("../../replies");

const iface = (references, in4Pass, in4Block, out4Pass, out4Block) => ({
    references, cleared: "Mon Jan 12 08:00:00 2026",
    in4_pass_packets: Math.round(in4Pass / 900), in4_pass_bytes: in4Pass,
    in4_block_packets: Math.round(in4Block / 60), in4_block_bytes: in4Block,
    out4_pass_packets: Math.round(out4Pass / 900), out4_pass_bytes: out4Pass,
    out4_block_packets: Math.round(out4Block / 60), out4_block_bytes: out4Block
});

const STATS = {
    interfaces: {
        all: iface(0, 9810450000, 1204800, 4103220000, 0),
        em0: iface(3, 5421300000, 1204800, 3980000000, 0),
        em1: iface(1, 4389150000, 0, 123220000, 0),
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
