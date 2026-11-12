// Simulated vCenter 7.0.3 replies. Shape follows the vSphere Automation REST API: POST /api/session (basic auth)
// returns 201 with the session id as a JSON string, GET /api/vcenter/vm/{vm} returns Vm.Info whose nics map holds,
// per nic key, label, type (E1000|E1000E|PCNET32|VMXNET|VMXNET2|VMXNET3), mac_type, mac_address, state
// (CONNECTED|RECOGNIZED|NOT_CONNECTED|UNRECOGNIZED) and backing { type (STANDARD_PORTGROUP|DISTRIBUTED_PORTGROUP|...),
// network (moref id), network_name }. The second nic is disconnected.
const reply = require("../../replies");

const SID = "6f1c2a9b8d7e4f3a2b1c0d9e8f7a6b5c";

const vm = {
    name: "web-frontend-01",
    power_state: "POWERED_ON",
    nics: {
        4000: {
            label: "Network adapter 1", type: "VMXNET3", mac_type: "ASSIGNED", mac_address: "00:50:56:a1:b2:c3", pci_slot_number: 160,
            wake_on_lan_enabled: false, start_connected: true, allow_guest_control: false, state: "CONNECTED",
            backing: { type: "STANDARD_PORTGROUP", network: "network-12", network_name: "VM Network" }
        },
        4001: {
            label: "Network adapter 2", type: "E1000E", mac_type: "MANUAL", mac_address: "00:50:56:01:02:03", pci_slot_number: 192,
            wake_on_lan_enabled: true, start_connected: false, allow_guest_control: true, state: "NOT_CONNECTED",
            backing: { type: "DISTRIBUTED_PORTGROUP", network: "dvportgroup-48", network_name: "DPG-Backup", connection_cookie: 1234567 }
        }
    }
};

function calls() {
    return [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/vcenter/vm/vm-101", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, vm) }
    ];
}

module.exports = {
    cases: [{
        name: "vcenter 7.0.3 vm nics",
        parameters: { vmId: "vm-101" },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
