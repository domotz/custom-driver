// Simulated Fujitsu PRIMERGY iRMC S5 replies. Shape follows the Fujitsu OEM Redfish ComponentStatus resource
// (/redfish/v1/Chassis/0/Oem/ts_fujitsu/ComponentStatus?$expand=*): one array per component class
// (Fans, TemperatureSensors, PowerSupplies, ...) of { Designation, EntityId, SignalStatus, ... }. SignalStatus
// is a Fujitsu enum (Ok, Warning, Critical, EmptyOrNotInstalled, ...). The exact member names are simulated.
const reply = require("../../replies");

const item = (designation, entityId, signalStatus) => ({ Designation: designation, EntityId: entityId, SignalStatus: signalStatus });

const BODY = {
    "@odata.context": "/redfish/v1/$metadata#Chassis/Members/0/Oem/ts_fujitsu/ComponentStatus/$entity",
    "@odata.id": "/redfish/v1/Chassis/0/Oem/ts_fujitsu/ComponentStatus",
    Id: "ComponentStatus",
    Name: "ComponentStatus",
    Fans: [item("FAN1 SYS", "Fan", "Ok"), item("FAN3 SYS", "Fan", "Critical")],
    TemperatureSensors: [item("Ambient", "Temperature", "Ok"), item("CPU1", "Temperature", "Warning")],
    PowerSupplies: [item("PSU1", "PowerSupply", "Ok"), item("PSU2", "PowerSupply", "EmptyOrNotInstalled")]
};

function calls() {
    return [{ kind: "http", method: "get", target: "/redfish/v1/Chassis/0/Oem/ts_fujitsu/ComponentStatus?$expand=*", headers: { Accept: "application/json" }, reply: reply.http(200, BODY, { "content-type": "application/json" }) }];
}

module.exports = {
    cases: [{
        name: "irmc s5 component status",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
