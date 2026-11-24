// Simulated Fujitsu PRIMERGY iRMC S5 replies. Shape follows the DMTF Redfish Thermal schema (v1.3) as served
// at /redfish/v1/Chassis/0/Thermal: Fans: [{ MemberId, Name, Reading, ReadingUnits: "RPM", Status: { State,
// Health }, LowerThresholdCritical, ... }]. A fan that is not Enabled has no Health (null) and no usable
// Reading; the driver then reports "Not enabled".
const reply = require("../../replies");

const fan = (n, name, reading, state, health) => ({
    "@odata.id": "/redfish/v1/Chassis/0/Thermal#/Fans/" + n, MemberId: String(n), Name: name, Reading: reading, ReadingUnits: "RPM",
    LowerThresholdCritical: 600, Status: { State: state, Health: health }
});

const BODY = {
    "@odata.context": "/redfish/v1/$metadata#Thermal.Thermal",
    "@odata.id": "/redfish/v1/Chassis/0/Thermal",
    "@odata.type": "#Thermal.v1_3_0.Thermal",
    Id: "Thermal",
    Name: "Thermal",
    Temperatures: [],
    Fans: [
        fan(0, "FAN1 SYS", 4560, "Enabled", "OK"),
        fan(1, "FAN2 SYS", 4620, "Enabled", "OK"),
        fan(2, "FAN3 SYS", 1180, "Enabled", "Warning"),
        fan(3, "FAN4 SYS", 4, "Disabled", null),
        // a stopped fan (Reading 0, Critical) and an empty bay (Absent, no Reading)
        fan(4, "FAN5 SYS", 0, "Enabled", "Critical"),
        fan(5, "FAN6 SYS", null, "Absent", null)
    ]
};

function calls() {
    return [{ kind: "http", method: "get", target: "/redfish/v1/Chassis/0/Thermal", headers: { Accept: "application/json" }, reply: reply.http(200, BODY, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "irmc s5 fans",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
