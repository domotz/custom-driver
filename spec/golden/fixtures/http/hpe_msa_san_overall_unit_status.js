// Simulated HPE MSA 2050 (VL270P005) replies. Shape follows the MSA CLI/XML API reference: GET /api/login
// answers with the session key (here in the command-status header, as the driver reads it) and every
// GET /api/show/<command> returns <RESPONSE VERSION="L100" REQUEST="<command>"> holding one <OBJECT> per
// row with <PROPERTY name=... type=... display-name=...> children, closed by a basetype="status" object.
// The exact command-status header text is not published; "1 <key>" is what the driver's parsing expects.
const reply = require("../../replies");

const KEY = "d0a6f2b4e5a7c93b45f6a7b8c9d0e1f2";

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

function sensor(oid, name, value, status, enclosureId) {
    return object("enclosure-sensors", "sensor-status", oid, {
        "durable-id": "sensor_" + oid, "enclosure-id": enclosureId || "1", "sensor-name": name, value: value, status: status
    });
}

// One enclosure; the Overall Unit Status row is not the first sensor and other rows have other statuses.
const sensors = [
    sensor(1, "Capacitor Pack Voltage-Ctlr A", "2.2", "Warning"),
    sensor(2, "Overall Unit Status", "OK", "OK"),
    sensor(3, "Temperature Loc: top-Ctlr A", "38", "OK"),
    sensor(4, "Current Loc: right-PSU 1", "4", "Unavailable")
];

// A controller enclosure plus an expansion enclosure: each has its own Overall Unit Status.
const sensorsWithExpansion = sensors.concat([
    sensor(5, "Overall Unit Status", "Degraded", "Warning", "2"),
    sensor(6, "Temperature Loc: left-IOM A", "35", "OK", "2")
]);

function replies(list) {
    return calls("sensor-status", xml("show sensor-status", list || sensors));
}

module.exports = {
    cases: [{
        name: "msa 2050 sensors",
        entryPoints: {
            validate: { calls: replies() },
            get_status: { calls: replies() }
        }
    }, {
        name: "msa 2050 with an expansion enclosure",
        entryPoints: {
            validate: { calls: replies(sensorsWithExpansion) },
            get_status: { calls: replies(sensorsWithExpansion) }
        }
    }]
};
