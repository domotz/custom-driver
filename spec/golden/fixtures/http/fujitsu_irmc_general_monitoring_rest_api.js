// Simulated Fujitsu PRIMERGY RX2540 M5 (iRMC S5) reply. Shape follows the DMTF Redfish ComputerSystem schema (v1.x)
// as served at /redfish/v1/Systems/0: Model, SerialNumber, BiosVersion, PowerState and
// Status { State, Health, HealthRollup }.
const reply = require("../../replies");

const SYSTEM = {
    "@odata.context": "/redfish/v1/$metadata#ComputerSystem.ComputerSystem",
    "@odata.id": "/redfish/v1/Systems/0",
    "@odata.type": "#ComputerSystem.v1_4_0.ComputerSystem",
    Id: "0",
    Name: "PRIMERGY RX2540 M5",
    SystemType: "Physical",
    Manufacturer: "FUJITSU",
    Model: "PRIMERGY RX2540 M5",
    SerialNumber: "YMVD000123",
    BiosVersion: "V5.0.0.14 R1.13.0 for D3384-A1x",
    PowerState: "On",
    Status: { State: "Enabled", Health: "Warning", HealthRollup: "Warning" }
};

function calls() {
    return [{ kind: "http", method: "get", target: "/redfish/v1/Systems/0", headers: { Accept: "application/json" }, reply: reply.http(200, SYSTEM, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "irmc s5 system",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
