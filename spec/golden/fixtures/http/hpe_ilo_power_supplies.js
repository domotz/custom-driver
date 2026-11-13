// Simulated HPE ProLiant DL380 Gen10 (iLO 5 2.78) replies. Shape follows the DMTF Redfish Power schema as
// served by the HPE iLO 5 Redfish API reference: GET /redfish/v1/Chassis/1/Power, PowerSupplies[] with
// Name "HpeServerPowerSupply", MemberId, Status { Health, State } (an empty bay is State "Absent").
const reply = require("../../replies");

const psu = (id, health, state, watts) => ({
    "@odata.id": "/redfish/v1/Chassis/1/Power/#PowerSupplies/" + id,
    MemberId: id,
    Name: "HpeServerPowerSupply",
    Model: "865414-B21",
    SerialNumber: "5WBXK0ARHA1" + id,
    FirmwareVersion: "1.00",
    PowerCapacityWatts: 800,
    LastPowerOutputWatts: watts,
    LineInputVoltage: 230,
    PowerSupplyType: "AC",
    Status: health ? { Health: health, State: state } : { State: state }
});

const power = {
    "@odata.context": "/redfish/v1/$metadata#Power.Power",
    "@odata.id": "/redfish/v1/Chassis/1/Power/",
    "@odata.type": "#Power.v1_3_0.Power",
    Id: "Power",
    Name: "Power",
    PowerSupplies: [psu("0", "OK", "Enabled", 142), psu("1", "Warning", "Enabled", 138), psu("2", null, "Absent", 0)]
};

const calls = () => [{ kind: "http", method: "get", target: "/redfish/v1/Chassis/1/Power", reply: reply.http(200, power) }];

module.exports = {
    cases: [{
        name: "dl380 gen10",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
