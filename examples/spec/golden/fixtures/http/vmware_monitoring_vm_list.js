// Simulated vCenter 7.0.3 replies. Shape follows the vSphere Automation REST API: POST /api/session
// (basic auth) returns 201 with the session id as a JSON string, GET /api/vcenter/vm returns the VM
// summary list (vm, name, power_state, cpu_count, memory_size_MiB).
const reply = require("../../replies");

const SID = "6f1c2a9b8d7e4f3a2b1c0d9e8f7a6b5c";

const vms = [
    { memory_size_MiB: 8192, vm: "vm-101", name: "web-frontend-01", power_state: "POWERED_ON", cpu_count: 4 },
    { memory_size_MiB: 4096, vm: "vm-102", name: "db-backup-02", power_state: "POWERED_OFF", cpu_count: 2 },
    { memory_size_MiB: 16384, vm: "vm-215", name: "build-agent-03", power_state: "SUSPENDED", cpu_count: 8 }
];

function calls() {
    return [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/vcenter/vm", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, vms) }
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
