// Simulated Dell PowerVault ME5024 replies. Shape follows the ME5 Redfish API: POST
// /redfish/v1/SessionService/Sessions/ returns 201 with the session token in the X-Auth-Token header,
// GET /redfish/v1/Storage lists the Storage resources, each /redfish/v1/Storage/<id> lists its Drives
// (@odata.id links) and each /redfish/v1/Storage/<id>/Drives/<n> is a DMTF Drive resource (Name,
// SerialNumber, Status, PhysicalLocation.Placement { Rack, RackOffset }).
const reply = require("../../replies");

const TOKEN = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const auth = { "X-Auth-Token": TOKEN };

function get(url, body) {
    return { kind: "http", method: "get", target: url, headers: auth, reply: reply.http(200, body) };
}

function storage(id, name, driveIds) {
    return {
        "@odata.id": "/redfish/v1/Storage/" + id, Id: id, Name: name, Status: { State: "Enabled", Health: "OK" },
        Drives: driveIds.map((n) => ({ "@odata.id": "/redfish/v1/Storage/" + id + "/Drives/" + n }))
    };
}

function drive(id, n, serial, rack, offset, state, health) {
    return {
        "@odata.id": "/redfish/v1/Storage/" + id + "/Drives/" + n,
        "@odata.type": "#Drive.v1_7_0.Drive",
        Id: String(n),
        Name: "Disk 0." + n,
        SerialNumber: serial,
        MediaType: "HDD",
        CapacityBytes: 1200243695616,
        Status: { State: state, Health: health },
        PhysicalLocation: { Placement: { Rack: rack, RackOffset: offset } }
    };
}

function calls() {
    return [
        {
            kind: "http", method: "post", target: "/redfish/v1/SessionService/Sessions/",
            reply: reply.http(201, { "@odata.id": "/redfish/v1/SessionService/Sessions/1", Id: "1", UserName: "user" }, { "x-auth-token": TOKEN })
        },
        get("/redfish/v1/Storage", { "@odata.id": "/redfish/v1/Storage", Name: "Storage Collection", Members: [{ "@odata.id": "/redfish/v1/Storage/A" }, { "@odata.id": "/redfish/v1/Storage/B" }] }),
        get("/redfish/v1/Storage/A", storage("A", "Controller A", [0, 1])),
        get("/redfish/v1/Storage/B", storage("B", "Controller B", [2, 3])),
        get("/redfish/v1/Storage/A/Drives/0", drive("A", 0, "WFK3A001", 1, 0, "Enabled", "OK")),
        get("/redfish/v1/Storage/A/Drives/1", drive("A", 1, "WFK3A002", 1, 1, "Enabled", "Warning")),
        get("/redfish/v1/Storage/B/Drives/2", drive("B", 2, "WFK3B003", 1, 2, "Enabled", "OK")),
        get("/redfish/v1/Storage/B/Drives/3", drive("B", 3, "WFK3B004", 1, 3, "Disabled", "OK"))
    ];
}

module.exports = {
    cases: [{
        name: "me5024 drives",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
