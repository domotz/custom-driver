// Simulated vCenter 8.0.2 replies. Shape follows the vSphere Web Services JSON API (vim25 8.0.1.0): POST
// /sdk/vim25/8.0.1.0/SessionManager/SessionManager/Login puts the session id in the vmware-api-session-id response
// header; GET /sdk/vim25/8.0.1.0/VirtualMachine/{moId}/snapshot returns VirtualMachineSnapshotInfo { currentSnapshot,
// rootSnapshotList: [{ snapshot: { type, value }, name, description, id, createTime (ISO 8601, UTC), state,
// quiesced, childSnapshotList: [...] }] }. Snapshots taken from the vSphere Client are named "<name> <locale date
// and time>", e.g. "VM Snapshot 1/13/2026, 11:15:08 PM" (the browser's local time, here UTC+1).
const reply = require("../../replies");

const SID = "5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d";
const LOGIN = { _typeName: "UserSession", key: SID, userName: "VSPHERE.LOCAL\\administrator" };

const snap = (value, name, description, createTime, children) => ({
    snapshot: { type: "VirtualMachineSnapshot", value }, vm: { type: "VirtualMachine", value: "vm-101" },
    name, description, id: parseInt(value.split("-")[1], 10), createTime, state: "poweredOff", quiesced: false,
    backupManifest: "", childSnapshotList: children || [], replaySupported: false
});

// A chain (Before patch -> After patch -> Nightly) plus an older, independent root snapshot.
const TREE = {
    currentSnapshot: { type: "VirtualMachineSnapshot", value: "snapshot-23" },
    rootSnapshotList: [
        snap("snapshot-21", "Before patch 1/12/2026, 12:05:00 AM", "pre-patch state", "2026-01-11T23:05:00.000Z", [
            snap("snapshot-22", "After patch 1/12/2026, 9:30:10 AM", "", "2026-01-12T08:30:10.250Z", [
                snap("snapshot-23", "VM Snapshot 1/13/2026, 11:15:08 PM", "Nightly snapshot", "2026-01-13T22:15:08.000Z")
            ])
        ]),
        snap("snapshot-9", "Golden image 12/2/2025, 12:00:00 PM", "Gold", "2025-12-02T11:00:00.000Z")
    ]
};

function calls() {
    return [
        { kind: "http", method: "post", target: "/sdk/vim25/8.0.1.0/SessionManager/SessionManager/Login", reply: reply.http(200, LOGIN, { "vmware-api-session-id": SID, "content-type": "application/json" }) },
        { kind: "http", method: "get", target: "/sdk/vim25/8.0.1.0/VirtualMachine/vm-101/snapshot", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, TREE) }
    ];
}

module.exports = {
    cases: [{
        name: "vcenter 8.0.2 snapshot tree",
        parameters: { vmId: "vm-101" },
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
