// Simulated vCenter Server Appliance 8.0.2 replies. Shape follows the vSphere Automation REST API:
// POST /api/session returns 201 with the session id as a JSON string, GET /api/appliance/system/version
// returns { type, version, product, build, releasedate, summary, install_time } where install_time is
// an ISO-8601 timestamp and releasedate a plain date string.
const reply = require("../../replies");

const SID = "5b4a39281706f5e4d3c2b1a09f8e7d6c";

const version = {
    type: "vCenter Server with an embedded Platform Services Controller",
    version: "8.0.2.00100",
    product: "VMware vCenter Server",
    build: "22617221",
    releasedate: "September 28, 2023",
    summary: "Patch for VMware vCenter Server",
    install_time: "2024-01-05T08:07:09.000Z"
};

function calls() {
    return [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/appliance/system/version", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, version) }
    ];
}

module.exports = {
    cases: [{
        name: "vcsa 8.0.2",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
