// Simulated Dell iDRAC 9 Redfish replies. Shape follows the DMTF Redfish Thermal schema (Thermal.v1_x) as served
// by iDRAC at /redfish/v1/Chassis/System.Embedded.1/Thermal: "@odata.id", a "Temperatures" array of
// { Name, ReadingCelsius, Lower/UpperThresholdNonCritical, Lower/UpperThresholdCritical, Status{Health,State} }.
const reply = require("../../replies");

const URL = "/redfish/v1/Chassis/System.Embedded.1/Thermal";

const THERMAL = {
    "@odata.context": "/redfish/v1/$metadata#Thermal.Thermal",
    "@odata.id": URL,
    "@odata.type": "#Thermal.v1_5_0.Thermal",
    Id: "Thermal",
    Name: "Thermal",
    Temperatures: [
        {
            "@odata.id": URL + "#/Temperatures/0",
            MemberId: "iDRAC.Embedded.1#SystemBoardInletTemp",
            Name: "System Board Inlet Temp",
            ReadingCelsius: 22,
            LowerThresholdNonCritical: 3,
            UpperThresholdNonCritical: 38,
            LowerThresholdCritical: -7,
            UpperThresholdCritical: 42,
            Status: { Health: "OK", State: "Enabled" }
        },
        {
            "@odata.id": URL + "#/Temperatures/1",
            MemberId: "iDRAC.Embedded.1#CPU1Temp",
            Name: "CPU1 Temp",
            ReadingCelsius: 78,
            LowerThresholdNonCritical: 3,
            UpperThresholdNonCritical: 75,
            LowerThresholdCritical: -7,
            UpperThresholdCritical: 90,
            Status: { Health: "Warning", State: "Enabled" }
        },
        {
            "@odata.id": URL + "#/Temperatures/2",
            MemberId: "iDRAC.Embedded.1#CPU2Temp",
            Name: "CPU2 Temp",
            ReadingCelsius: null,
            LowerThresholdNonCritical: null,
            UpperThresholdNonCritical: null,
            LowerThresholdCritical: null,
            UpperThresholdCritical: null,
            Status: { Health: null, State: "Disabled" }
        }
    ],
    "Temperatures@odata.count": 3
};

const call = () => ({ kind: "http", method: "get", target: URL, reply: reply.http(200, THERMAL) });

module.exports = {
    cases: [{
        name: "iDRAC 9 redfish thermal",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
