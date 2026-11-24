// Simulated Dell PowerVault ME5024 replies. Shape follows the ME5 Redfish API: POST
// /redfish/v1/SessionService/Sessions/ returns 201 with the session token in the X-Auth-Token header,
// GET /redfish/v1/Storage returns the Storage collection (Members with @odata.id) and each
// /redfish/v1/Storage/<id> is a Storage resource (DMTF Storage.v1_x) with a StorageControllers array
// (Name, SerialNumber, Status { State, Health }).
const reply = require("../../replies");

const TOKEN = "0a1b2c3d4e5f60718293a4b5c6d7e8f9";
const auth = { "X-Auth-Token": TOKEN };

function storage(id, name, serial, health) {
    return {
        "@odata.id": "/redfish/v1/Storage/" + id,
        "@odata.type": "#Storage.v1_10_0.Storage",
        Id: id,
        Name: name,
        Status: { State: "Enabled", Health: health },
        StorageControllers: [{
            "@odata.id": "/redfish/v1/Storage/" + id + "#/StorageControllers/0",
            MemberId: "0",
            Name: name,
            SerialNumber: serial,
            Manufacturer: "Dell EMC",
            Status: { State: "Enabled", Health: health }
        }]
    };
}

function calls() {
    return [
        {
            kind: "http", method: "post", target: "/redfish/v1/SessionService/Sessions/",
            reply: reply.http(201, { "@odata.id": "/redfish/v1/SessionService/Sessions/1", Id: "1", UserName: "user" }, { "x-auth-token": TOKEN })
        },
        {
            kind: "http", method: "get", target: "/redfish/v1/Storage", headers: auth,
            reply: reply.http(200, {
                "@odata.id": "/redfish/v1/Storage",
                "@odata.type": "#StorageCollection.StorageCollection",
                Name: "Storage Collection",
                "Members@odata.count": 2,
                Members: [{ "@odata.id": "/redfish/v1/Storage/A" }, { "@odata.id": "/redfish/v1/Storage/B" }]
            })
        },
        { kind: "http", method: "get", target: "/redfish/v1/Storage/A", headers: auth, reply: reply.http(200, storage("A", "Controller A", "7T2LQ93-A", "OK")) },
        { kind: "http", method: "get", target: "/redfish/v1/Storage/B", headers: auth, reply: reply.http(200, storage("B", "Controller B", "7T2LQ93-B", "Critical")) }
    ];
}

module.exports = {
    cases: [{
        name: "me5024 controllers",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
