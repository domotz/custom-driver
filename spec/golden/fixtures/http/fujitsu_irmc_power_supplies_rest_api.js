// Simulated Fujitsu PRIMERGY iRMC S5 replies. Shape follows the DMTF Redfish Power schema (v1.x) as served at
// /redfish/v1/Chassis/0/Power: PowerSupplies: [{ MemberId, Name, Status: { State, Health }, PowerCapacityWatts,
// LastPowerOutputWatts, ... }]. A bay with no unit fitted is State "Absent" with no Health.
const reply = require("../../replies");

const psu = (n, name, state, health) => ({
    "@odata.id": "/redfish/v1/Chassis/0/Power#/PowerSupplies/" + n, MemberId: String(n), Name: name,
    PowerCapacityWatts: 800, LastPowerOutputWatts: 212, Status: { State: state, Health: health }
});

const BODY = {
    "@odata.context": "/redfish/v1/$metadata#Power.Power",
    "@odata.id": "/redfish/v1/Chassis/0/Power",
    "@odata.type": "#Power.v1_3_0.Power",
    Id: "Power",
    Name: "Power",
    PowerSupplies: [
        psu(0, "PSU1", "Enabled", "OK"),
        psu(1, "PSU2", "Enabled", "Critical"),
        psu(2, "PSU3", "Absent", null)
    ]
};

function calls() {
    return [{ kind: "http", method: "get", target: "/redfish/v1/Chassis/0/Power", headers: { Accept: "application/json" }, reply: reply.http(200, BODY, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "irmc s5 power",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
