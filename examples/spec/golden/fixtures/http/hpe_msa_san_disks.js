// Simulated HPE MSA 2050 (VL270P005) replies. Shape follows the MSA CLI/XML API reference: GET /api/login
// answers with the session key (here in the command-status header, as the driver reads it) and every
// GET /api/show/<command> returns <RESPONSE VERSION="L100" REQUEST="<command>"> holding one <OBJECT> per
// row with <PROPERTY name=... type=... display-name=...> children, closed by a basetype="status" object.
// The exact command-status header text is not published; "1 <key>" is what the driver's parsing expects.
const reply = require("../../replies");

const KEY = "a7f3c9e1b2d4f60812c3d4e5f6a7b8c9";

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

const disks = [
    object("drives", "drive", "1", {
        "durable-id": "disk_01.01", location: "1.1", "serial-number": "WBN0A1B2", usage: "VIRTUAL POOL",
        "disk-group": "dgA01", "storage-pool-name": "A", "storage-tier": "Standard", status: "Up", health: "OK"
    }),
    object("drives", "drive", "2", {
        "durable-id": "disk_01.02", location: "1.2", "serial-number": "WBN0C3D4", usage: "GLOBAL SPARE",
        "disk-group": "", "storage-pool-name": "", "storage-tier": "N/A", status: "Up", health: "OK"
    }),
    object("drives", "drive", "3", {
        "durable-id": "disk_01.03", location: "1.3", "serial-number": "WBN0E5F6", usage: "FAILED",
        "disk-group": "dgA01", "storage-pool-name": "A", "storage-tier": "Standard", status: "Warning", health: "Degraded"
    })
];

function replies() {
    return calls("disks", xml("show disks", disks));
}

module.exports = {
    cases: [{
        name: "msa 2050 disks",
        entryPoints: {
            validate: { calls: replies() },
            get_status: { calls: replies() }
        }
    }]
};
