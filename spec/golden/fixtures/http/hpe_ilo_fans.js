// Simulated HPE ProLiant DL380 Gen10 (iLO 5 2.78) replies. Shape follows the DMTF Redfish Thermal schema as
// served by the HPE iLO 5 Redfish API reference: GET /redfish/v1/Chassis/1/Thermal, Fans[] with Name,
// Reading, ReadingUnits "Percent" and Status { Health, State }. Fan 4 has stopped (Reading 0, Critical);
// bay 5 is empty (State Absent, no Health, Reading null).
const reply = require("../../replies");

const thermal = {
    "@odata.context": "/redfish/v1/$metadata#Thermal.Thermal",
    "@odata.id": "/redfish/v1/Chassis/1/Thermal/",
    "@odata.type": "#Thermal.v1_1_0.Thermal",
    Id: "Thermal",
    Name: "Thermal",
    Fans: [
        { MemberId: "0", Name: "Fan 1", Reading: 21, ReadingUnits: "Percent", Status: { Health: "OK", State: "Enabled" } },
        { MemberId: "1", Name: "Fan 2", Reading: 35, ReadingUnits: "Percent", Status: { Health: "Warning", State: "Enabled" } },
        { MemberId: "2", Name: "Fan 3", Reading: 22, ReadingUnits: "Percent", Status: { Health: "OK", State: "Enabled" } },
        { MemberId: "3", Name: "Fan 4", Reading: 0, ReadingUnits: "Percent", Status: { Health: "Critical", State: "Enabled" } },
        { MemberId: "4", Name: "Fan 5", Reading: null, ReadingUnits: "Percent", Status: { State: "Absent" } }
    ],
    Temperatures: [
        { MemberId: "0", Name: "01-Inlet Ambient", PhysicalContext: "Intake", ReadingCelsius: 22, UpperThresholdCritical: 42, UpperThresholdFatal: 47, Status: { Health: "OK", State: "Enabled" } },
        { MemberId: "1", Name: "02-CPU 1", PhysicalContext: "CPU", ReadingCelsius: 40, UpperThresholdCritical: 70, UpperThresholdFatal: null, Status: { Health: "OK", State: "Enabled" } },
        { MemberId: "2", Name: "03-CPU 2", PhysicalContext: "CPU", ReadingCelsius: 74, UpperThresholdCritical: 70, UpperThresholdFatal: null, Status: { Health: "Critical", State: "Enabled" } },
        { MemberId: "3", Name: "04-P1 DIMM 1-6", PhysicalContext: "SystemBoard", ReadingCelsius: 31, UpperThresholdCritical: 90, UpperThresholdFatal: null, Status: { Health: "OK", State: "Enabled" } },
        { MemberId: "4", Name: "05-P2 DIMM 7-12", PhysicalContext: "SystemBoard", ReadingCelsius: null, UpperThresholdCritical: 90, UpperThresholdFatal: null, Status: { State: "Absent" } }
    ]
};

const calls = () => [{ kind: "http", method: "get", target: "/redfish/v1/Chassis/1/Thermal", reply: reply.http(200, thermal) }];

module.exports = {
    cases: [{
        name: "dl380 gen10",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
