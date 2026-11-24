// Simulated HPE MSA 2050 (VL270P005) replies. Shape follows the MSA CLI/XML API reference: GET /api/login
// answers with the session key (here in the command-status header, as the driver reads it) and every
// GET /api/show/<command> returns <RESPONSE VERSION="L100" REQUEST="<command>"> holding one <OBJECT> per
// row with <PROPERTY name=... type=... display-name=...> children, closed by a basetype="status" object.
// The exact command-status header text is not published; "1 <key>" is what the driver's parsing expects.
const reply = require("../../replies");

const KEY = "c9f5e1a3d4f6b82a34e5f6a7b8c9d0e1";

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

const system = object("system", "system-information", "1", {
    "system-name": "MSA2050-DC1", "product-id": "MSA 2050 SAN", "midplane-serial-number": "00C0FFF1A2B3",
    "vendor-name": "HPE", health: "Degraded", "health-numeric": "1",
    "health-reason": "The system is operational, but one or more disks have failed."
});

function replies() {
    return calls("system", xml("show system", [system]));
}

module.exports = {
    cases: [{
        name: "msa 2050 system",
        entryPoints: {
            validate: { calls: replies() },
            get_status: { calls: replies() }
        }
    }]
};
