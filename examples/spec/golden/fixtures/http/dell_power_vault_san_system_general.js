// Simulated Dell PowerVault ME5024 replies. Shape follows the ME5 Redfish API: POST
// /redfish/v1/SessionService/Sessions/ returns 201 with the session token in the X-Auth-Token header
// (node's request library lower-cases header names), GET /redfish/v1/Chassis/0 returns the Chassis
// resource (SerialNumber, PowerState, Status { State, Health }).
const reply = require("../../replies");

const TOKEN = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";

const chassis = {
    "@odata.id": "/redfish/v1/Chassis/0",
    "@odata.type": "#Chassis.v1_14_0.Chassis",
    Id: "0",
    Name: "Enclosure 0",
    ChassisType: "Enclosure",
    Manufacturer: "Dell EMC",
    Model: "ME5024",
    SerialNumber: "7T2LQ93",
    PowerState: "On",
    Status: { State: "Enabled", Health: "Warning" }
};

function calls() {
    return [
        {
            kind: "http", method: "post", target: "/redfish/v1/SessionService/Sessions/",
            reply: reply.http(201, { "@odata.id": "/redfish/v1/SessionService/Sessions/1", Id: "1", UserName: "user" }, { "x-auth-token": TOKEN })
        },
        { kind: "http", method: "get", target: "/redfish/v1/Chassis/0", headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, chassis) }
    ];
}

module.exports = {
    cases: [{
        name: "me5024",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
