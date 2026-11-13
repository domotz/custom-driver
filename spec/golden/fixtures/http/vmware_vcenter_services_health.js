// Simulated vCenter Server Appliance 7.0.3 replies. Shape follows the vSphere Automation REST API:
// POST /api/session returns 201 with the session id as a JSON string; GET /api/vcenter/services returns a
// map of service name -> { name_key, description_key, startup_type, state, health, health_messages }
// (startup_type MANUAL|AUTOMATIC|DISABLED, state STARTED|STOPPED|STARTING|STOPPING, health HEALTHY|
// HEALTHY_WITH_WARNINGS|DEGRADED, absent when the service is not running).
const reply = require("../../replies");

const SID = "2d4f6a8c0e1b3d5f7a9c1e3b5d7f9a0c";

const services = {
    vpxd: { name_key: "vpxd", description_key: "VMware vCenter Server", startup_type: "AUTOMATIC", state: "STARTED", health: "HEALTHY", health_messages: [] },
    "vsphere-ui": { name_key: "vsphere-ui", description_key: "vSphere Client", startup_type: "AUTOMATIC", state: "STARTED", health: "HEALTHY_WITH_WARNINGS", health_messages: [] },
    vmware_vsan_health: { name_key: "vsan-health", description_key: "VMware vSAN Health Service", startup_type: "AUTOMATIC", state: "STARTED", health: "DEGRADED", health_messages: [] },
    "vmware-vmon": { name_key: "vmon", description_key: "VMware Service Lifecycle Manager", startup_type: "MANUAL", state: "STOPPED", health_messages: [] }
};

function calls() {
    return [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/vcenter/services", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, services) }
    ];
}

module.exports = {
    cases: [{
        name: "vcsa 7.0.3 services",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
