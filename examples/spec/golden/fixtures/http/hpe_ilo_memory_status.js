// Simulated HPE ProLiant DL380 Gen10 (iLO 5 2.78) replies. Shape follows the DMTF Redfish Memory schema as
// served by the HPE iLO 5 Redfish API reference: GET /redfish/v1/Systems/1/Memory?$expand=. returns the
// MemoryCollection with every Memory resource inline in Members (DeviceLocator, Status { Health, State };
// an empty socket is State "Absent").
const reply = require("../../replies");

const dimm = (locator, health, state, mib) => ({
    "@odata.id": "/redfish/v1/Systems/1/Memory/proc1dimm" + locator.replace(/\D+/g, "") + "/",
    "@odata.type": "#Memory.v1_7_1.Memory",
    Id: "proc1dimm" + locator.replace(/\D+/g, ""),
    Name: locator,
    DeviceLocator: locator,
    CapacityMiB: mib,
    MemoryDeviceType: "DDR4",
    OperatingSpeedMhz: 2933,
    Manufacturer: "HPE",
    PartNumber: "840758-091",
    Status: health ? { Health: health, State: state } : { State: state }
});

const memory = {
    "@odata.context": "/redfish/v1/$metadata#MemoryCollection.MemoryCollection",
    "@odata.id": "/redfish/v1/Systems/1/Memory/",
    "@odata.type": "#MemoryCollection.MemoryCollection",
    Name: "Memory DIMMs",
    "Members@odata.count": 4,
    Members: [
        dimm("PROC 1 DIMM 1", "OK", "Enabled", 32768),
        dimm("PROC 1 DIMM 2", "Warning", "Enabled", 32768),
        dimm("PROC 1 DIMM 3", null, "Absent", 0),
        dimm("PROC 2 DIMM 1", "OK", "Enabled", 32768)
    ]
};

const calls = () => [{ kind: "http", method: "get", target: /\/redfish\/v1\/Systems\/1\/Memory\?\$expand=\./, reply: reply.http(200, memory) }];

module.exports = {
    cases: [{
        name: "dl380 gen10",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
