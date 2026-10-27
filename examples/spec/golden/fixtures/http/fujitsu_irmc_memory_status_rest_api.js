// Simulated Fujitsu PRIMERGY iRMC S5 replies. Shape follows the DMTF Redfish Memory collection (v1.x) as
// served, expanded, at /redfish/v1/Systems/0/Memory?$expand=Members: Members: [{ Id, Name, DeviceLocator,
// CapacityMiB, Status: { State, Health } }]. An empty slot is State "Absent" with no Health.
const reply = require("../../replies");

const dimm = (n, slot, state, health) => ({
    "@odata.id": "/redfish/v1/Systems/0/Memory/" + n, Id: String(n), Name: "Memory " + slot, DeviceLocator: slot,
    CapacityMiB: state === "Enabled" ? 16384 : 0, Status: { State: state, Health: health }
});

const BODY = {
    "@odata.context": "/redfish/v1/$metadata#MemoryCollection.MemoryCollection",
    "@odata.id": "/redfish/v1/Systems/0/Memory",
    "@odata.type": "#MemoryCollection.MemoryCollection",
    Name: "Memory Collection",
    "Members@odata.count": 4,
    Members: [
        dimm(0, "DIMM-1A", "Enabled", "OK"),
        dimm(1, "DIMM-2A", "Enabled", "Warning"),
        dimm(2, "DIMM-3A", "Absent", null),
        dimm(3, "DIMM-4A", "Enabled", "Critical")
    ]
};

function calls() {
    return [{ kind: "http", method: "get", target: "/redfish/v1/Systems/0/Memory?$expand=Members", headers: { Accept: "application/json" }, reply: reply.http(200, BODY, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "irmc s5 memory",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
