// Simulated vCenter 7.0.3 replies. Shape follows the vSphere Automation REST API: POST /api/session
// (basic auth) returns 201 with the session id as a JSON string, GET /api/vcenter/vm/{vm} returns the VM
// info (Vm.Info) whose disks map holds, per disk key, label, type (IDE|SCSI|SATA|NVME), capacity in bytes
// and backing { type: VMDK_FILE, vmdk_file }.
const reply = require("../../replies");

const SID = "6f1c2a9b8d7e4f3a2b1c0d9e8f7a6b5c";
const GiB = 1024 * 1024 * 1024;

const vm = {
    name: "web-frontend-01",
    power_state: "POWERED_ON",
    guest_OS: "UBUNTU_64",
    disks: {
        2000: {
            label: "Hard disk 1", type: "SCSI", capacity: 40 * GiB,
            scsi: { bus: 0, unit: 0 }, backing: { type: "VMDK_FILE", vmdk_file: "[datastore1] web-frontend-01/web-frontend-01.vmdk" }
        },
        2001: {
            label: "Hard disk 2", type: "SATA", capacity: 250.5 * GiB,
            sata: { bus: 0, unit: 0 }, backing: { type: "VMDK_FILE", vmdk_file: "[datastore2] web-frontend-01/web-frontend-01_1.vmdk" }
        },
        2002: {
            label: "Hard disk 3", type: "NVME", capacity: 1024 * GiB,
            nvme: { bus: 0, unit: 0 }, backing: { type: "VMDK_FILE", vmdk_file: "[datastore2] web-frontend-01/web-frontend-01_2.vmdk" }
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
        name: "vcenter 7.0.3 vm disks",
        parameters: { vmId: "vm-101" },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
