// Simulated HPE ProLiant DL380 Gen10 (iLO 5 2.78) replies. Shape follows the DMTF Redfish ComputerSystem
// schema as served by the HPE iLO 5 Redfish API reference: GET /redfish/v1/Systems/1 (Model, BiosVersion,
// SerialNumber, Status { Health, HealthRollup, State }, @odata.id with a trailing slash).
const reply = require("../../replies");

const system = {
    "@odata.context": "/redfish/v1/$metadata#ComputerSystem.ComputerSystem",
    "@odata.etag": "W/\"0A1B2C3D\"",
    "@odata.id": "/redfish/v1/Systems/1/",
    "@odata.type": "#ComputerSystem.v1_13_0.ComputerSystem",
    Id: "1",
    Name: "Computer System",
    Model: "ProLiant DL380 Gen10",
    Manufacturer: "HPE",
    SystemType: "Physical",
    SerialNumber: "CZ2311ABCD",
    SKU: "868703-B21",
    BiosVersion: "U30 v2.72 (05/24/2022)",
    PowerState: "On",
    Status: { Health: "OK", HealthRollup: "OK", State: "Enabled" }
};

const calls = () => [{ kind: "http", method: "get", target: "/redfish/v1/Systems/1", reply: reply.http(200, system) }];

module.exports = {
    cases: [{
        name: "dl380 gen10",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
