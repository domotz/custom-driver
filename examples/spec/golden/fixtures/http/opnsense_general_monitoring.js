// Simulated OPNsense 23.7 (FreeBSD 13.2) replies. Shape follows the OPNsense API reference: GET
// /api/core/firmware/status returns { status, status_msg, product_version, ... } and POST
// /api/diagnostics/activity/getActivity returns { headers: [...top header lines], details: [...] } where headers
// are the FreeBSD top(1) lines: "last pid ...", "N processes ...", "CPU: ...", "Mem: ...", "Swap: ...".
// top scales each figure on its own (K, M, G), so the Mem line mixes M and G suffixes on a 16 GB firewall.
const reply = require("../../replies");

const FIRMWARE = {
    status: "none",
    status_msg: "There are no updates available on the selected mirror.",
    product_name: "opnsense",
    product_version: "23.7.12_5",
    needs_reboot: "0"
};

const ACTIVITY = {
    headers: [
        "last pid: 41873;  load averages:  0.31,  0.34,  0.29  up 12+03:21:10    10:00:00",
        "131 processes: 1 running, 130 sleeping",
        "CPU:  1.2% user,  0.0% nice,  0.8% system,  0.4% interrupt, 97.6% idle",
        "Mem: 214M Active, 1245M Inact, 52M Laundry, 980M Wired, 512M Buf, 12G Free",
        "Swap: 8192M Total, 8100M Free"
    ],
    details: [
        { PID: "41873", USERNAME: "root", THR: "1", PRI: "20", NICE: "0", SIZE: "13M", RES: "3500K", STATE: "CPU1", C: "1", TIME: "0:00", WCPU: "0.10%", COMMAND: "top" }
    ]
};

function calls() {
    return [
        { kind: "http", method: "get", target: "/api/core/firmware/status", reply: reply.http(200, FIRMWARE, { "content-type": "application/json" }) },
        { kind: "http", method: "post", target: "/api/diagnostics/activity/getActivity", reply: reply.http(200, ACTIVITY, { "content-type": "application/json" }) }
    ];
}

module.exports = {
    cases: [{
        name: "opnsense 23.7",
        parameters: { portNumber: 443 },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
