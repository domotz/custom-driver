// Simulated OPNsense 23.7 replies. Shape follows the OPNsense API reference (diagnostics/firewall): GET
// /api/diagnostics/firewall/pf_statistics/rules returns { rules: { "filter rules": { <rule label>: { evaluations,
// packets, bytes, states, state_creations } }, "nat rules": { ... } } } (pfctl -vvsr / -vvsn counters, keyed by
// the rule description). One rule has never matched, to show zero counters.
const reply = require("../../replies");

const RULES = {
    rules: {
        "filter rules": {
            "Default allow LAN to any rule": { evaluations: 48210, packets: 9120331, bytes: 7345129800, states: 211, state_creations: 1048213 },
            "Block private networks": { evaluations: 912, packets: 0, bytes: 0, states: 0, state_creations: 0 }
        },
        "nat rules": {
            "Automatic outbound NAT": { evaluations: 31002, packets: 1920331, bytes: 1745129800, states: 98, state_creations: 502113 },
            "Port forward HTTPS to web server": { evaluations: 8812, packets: 20331, bytes: 14129800, states: 3, state_creations: 1290 },
            "Unused redirect": { evaluations: 8812, packets: 0, bytes: 0, states: 0, state_creations: 0 }
        }
    }
};

function calls() {
    return [{ kind: "http", method: "get", target: "/api/diagnostics/firewall/pf_statistics/rules", reply: reply.http(200, RULES, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "opnsense 23.7 all rules",
        parameters: { ruleName: ["ALL"], portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }, {
        name: "opnsense 23.7 rules matching a name",
        parameters: { ruleName: ["port forward", "automatic"], portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
