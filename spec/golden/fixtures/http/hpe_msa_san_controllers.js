// Simulated HPE MSA 2050 (VL270P005) replies. Shape follows the MSA CLI/XML API reference: GET /api/login
// answers with the session key (here in the command-status header, as the driver reads it) and every
// GET /api/show/<command> returns <RESPONSE VERSION="L100" REQUEST="<command>"> holding one <OBJECT> per
// row with <PROPERTY name=... type=... display-name=...> children, closed by a basetype="status" object.
// The exact command-status header text is not published; "1 <key>" is what the driver's parsing expects.
const reply = require("../../replies");

const KEY = "b8e4d0f2c3e5a71923d4e5f6a7b8c9d0";

function prop(name, value) {
    return '<PROPERTY name="' + name + '" type="string" size="32" draw="false" sort="string" display-name="' + name + '">' + value + "</PROPERTY>";
}

function xml(request, objects) {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<RESPONSE VERSION="L100" REQUEST="' + request + '">\n'
        + objects.join("\n")
        + '\n<OBJECT basetype="status" name="status" oid="99">'
        + prop("response-type", "Success") + prop("response-type-numeric", "0")
        + prop("response", "Command completed successfully. (2024-05-14 09:12:41)") + prop("return-code", "0")
        + "</OBJECT>\n</RESPONSE>\n";
}

function object(basetype, name, oid, props) {
    return '<OBJECT basetype="' + basetype + '" name="' + name + '" oid="' + oid + '">'
        + Object.keys(props).map((k) => prop(k, props[k])).join("") + "</OBJECT>";
}

function calls(command, body) {
    const loginXml = xml("login", [object("status", "status", "1", { "response-type": "Success", response: KEY })]);
    return [
        { kind: "http", method: "get", target: "/api/login", reply: reply.http(200, loginXml, { "command-status": "1 " + KEY }) },
        { kind: "http", method: "get", target: "/api/show/" + command, headers: { sessionKey: KEY }, reply: reply.http(200, body) }
    ];
}

function controller(oid, id, ip, status, health, mode, redundancy) {
    // Real show controllers rows carry nested network-parameters objects after the controller properties.
    return '<OBJECT basetype="controllers" name="controllers" oid="' + oid + '">'
        + prop("controller-id", id) + prop("serial-number", "SN" + id + "0042") + prop("ip-address", ip)
        + prop("disks", "24") + prop("status", status) + prop("health", health)
        + prop("redundancy-mode", mode) + prop("redundancy-status", redundancy)
        + '<OBJECT basetype="network-parameters" name="network-parameters" oid="' + (oid + 10) + '">'
        + prop("ip-address", ip) + prop("status", "Up") + prop("health", "OK") + "</OBJECT></OBJECT>";
}

const controllers = [
    controller(1, "A", "10.0.5.11", "Operational", "OK", "Active-Active ULP", "Redundant"),
    controller(2, "B", "10.0.5.12", "Down", "Fault", "Active-Active ULP", "Operational but not redundant")
];

function replies() {
    return calls("controllers", xml("show controllers", controllers));
}

module.exports = {
    cases: [{
        name: "msa 2050 controllers",
        entryPoints: {
            validate: { calls: replies() },
            get_status: { calls: replies() }
        }
    }]
};
