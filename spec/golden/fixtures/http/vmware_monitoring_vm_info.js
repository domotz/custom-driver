// Simulated vCenter 7.0.3 replies. Shape follows the vSphere Automation REST API: POST /api/session (basic auth)
// returns 201 with the session id as a JSON string, GET /api/vcenter/vm/{vm} returns Vm.Info: name, guest_OS,
// power_state (POWERED_ON|POWERED_OFF|SUSPENDED), identity { name, instance_uuid, bios_uuid }, memory { size_MiB },
// cpu { count, cores_per_socket } and hardware { version, upgrade_policy }.
const reply = require("../../replies");

const SID = "6f1c2a9b8d7e4f3a2b1c0d9e8f7a6b5c";

const vms = {
    "vm-101": {
        name: "web-frontend-01", guest_OS: "UBUNTU_64", power_state: "POWERED_ON",
        identity: { name: "web-frontend-01", instance_uuid: "5002a1b2-c3d4-4e5f-8a9b-0c1d2e3f4a5b", bios_uuid: "4202d1c0-b9a8-4f7e-6d5c-4b3a29180716" },
        memory: { size_MiB: 8192, hot_add_enabled: false },
        cpu: { count: 4, cores_per_socket: 2, hot_add_enabled: false, hot_remove_enabled: false },
        hardware: { version: "VMX_19", upgrade_policy: "NEVER" }
    },
    "vm-202": {
        name: "legacy-db", guest_OS: "WINDOWS_SERVER_2012_R2_64", power_state: "POWERED_OFF",
        identity: { name: "legacy-db", instance_uuid: "5002ffee-dd11-4a22-b333-c4445555d666", bios_uuid: "4202a0b1-c2d3-4e4f-5a6b-7c8d9e0f1a2b" },
        memory: { size_MiB: 1536 },
        cpu: { count: 1, cores_per_socket: 1 },
        hardware: { version: "VMX_13", upgrade_policy: "NEVER" }
    }
};

function calls(vmId) {
    return [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/vcenter/vm/" + vmId, headers: { "vmware-api-session-id": SID }, reply: reply.http(200, vms[vmId]) }
    ];
}

module.exports = {
    cases: Object.keys(vms).map((vmId) => ({
        name: "vcenter 7.0.3 " + vms[vmId].name,
        parameters: { vmId },
        entryPoints: { validate: { calls: calls(vmId) }, get_status: { calls: calls(vmId) } }
    }))
};
