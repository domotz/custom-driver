// Simulated vCenter Server Appliance 8.0.2 replies. Shape follows the vSphere Automation REST API:
// POST /api/session returns 201 with the session id as a JSON string; each GET /api/appliance/health/*
// returns the health color as a JSON string (green, yellow, orange, red, gray).
const reply = require("../../replies");

const SID = "2d4f6a8c0e1b3d5f7a9c1e3b5d7f9a0c";

const health = {
    system: "green",
    load: "orange",
    mem: "green",
    applmgmt: "green",
    storage: "red",
    swap: "yellow",
    "database-storage": "green",
    "software-packages": "gray"
};

function calls() {
    const list = [{ kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) }];
    Object.keys(health).forEach((name) => {
        list.push({
            kind: "http", method: "get", target: "/api/appliance/health/" + name,
            headers: { "vmware-api-session-id": SID }, reply: reply.http(200, JSON.stringify(health[name]))
        });
    });
    return list;
}

module.exports = {
    cases: [{
        name: "vcsa 8.0.2",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
