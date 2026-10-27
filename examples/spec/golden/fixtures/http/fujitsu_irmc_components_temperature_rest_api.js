// Simulated Fujitsu PRIMERGY iRMC S5 replies. Shape follows the DMTF Redfish Thermal schema (v1.x) as served
// at /redfish/v1/Chassis/0/Thermal: { "@odata.id", Id, Name, Temperatures: [{ MemberId, Name, ReadingCelsius,
// Status: { State, Health }, UpperThresholdCritical, ... }], Fans: [...] }. A sensor whose State is not
// Enabled (here an absent second CPU) carries no reading.
const reply = require("../../replies");

const THERMAL = {
    "@odata.context": "/redfish/v1/$metadata#Thermal.Thermal",
    "@odata.id": "/redfish/v1/Chassis/0/Thermal",
    "@odata.type": "#Thermal.v1_3_0.Thermal",
    Id: "Thermal",
    Name: "Thermal",
    Temperatures: [
        { "@odata.id": "/redfish/v1/Chassis/0/Thermal#/Temperatures/0", MemberId: "0", Name: "Ambient", ReadingCelsius: 24, UpperThresholdCritical: 42, Status: { State: "Enabled", Health: "OK" } },
        { "@odata.id": "/redfish/v1/Chassis/0/Thermal#/Temperatures/1", MemberId: "1", Name: "CPU1", ReadingCelsius: 87, UpperThresholdCritical: 85, Status: { State: "Enabled", Health: "Critical" } },
        { "@odata.id": "/redfish/v1/Chassis/0/Thermal#/Temperatures/2", MemberId: "2", Name: "CPU2", Status: { State: "Absent" } },
        { "@odata.id": "/redfish/v1/Chassis/0/Thermal#/Temperatures/3", MemberId: "3", Name: "Systemboard 1", ReadingCelsius: 38, UpperThresholdCritical: 75, Status: { State: "Enabled", Health: "Warning" } }
    ],
    Fans: []
};

function calls() {
    return [{ kind: "http", method: "get", target: "/redfish/v1/Chassis/0/Thermal", headers: { Accept: "application/json" }, reply: reply.http(200, THERMAL, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "irmc s5 thermal",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
