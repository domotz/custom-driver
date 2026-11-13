// Simulated vCenter 7.0.3 replies. Shape follows the vSphere Automation REST API: POST /api/session
// returns 201 with the session id as a JSON string, GET /api/vcenter/datastore returns the datastore
// summaries (datastore, name, type, free_space and capacity in bytes).
const reply = require("../../replies");

const SID = "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d";
const GIB = 1024 * 1024 * 1024;

const datastores = [
    { datastore: "datastore-11", name: "datastore1", type: "VMFS", free_space: 412 * GIB + 330 * 1024 * 1024, capacity: 1024 * GIB },
    { datastore: "datastore-12", name: "nfs-backup", type: "NFS", free_space: 36 * GIB, capacity: 2048 * GIB },
    { datastore: "datastore-13", name: "vsan-prod", type: "vsan", free_space: 5 * GIB, capacity: 500 * GIB }
];

function calls() {
    return [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/vcenter/datastore", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, datastores) }
    ];
}

module.exports = {
    cases: [{
        name: "vcenter 7.0.3",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
