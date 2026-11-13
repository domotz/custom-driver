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

const sensor = (oid, name, value, status, type, durable) => object("sensors", "sensor-status", oid, {
    "enclosure-id": "1", "drawer-id": "255", "sensor-name": name, value, status,
    "container": "controllers", "sensor-type": type, "durable-id": durable
});

const items = [
    sensor("1", "Temp Ctlr A", "41C", "OK", "Temperature", "sensor_temp_ctrl_A.1"),
    sensor("2", "Capacitor Charge-Ctlr A", "94%", "OK", "Charge Capacity", "sensor_charge_ctrl_A.1"),
    sensor("3", "Capacitor Charge-Ctlr B", "62%", "Warning", "Charge Capacity", "sensor_charge_ctrl_B.1"),
    sensor("4", "Voltage 5V Ctlr A", "5.06", "OK", "Voltage", "sensor_volt_ctrl_A.1")
];

function replies() {
    return calls("sensor-status", xml("show sensor-status", items));
}

module.exports = {
    cases: [{
        name: "msa 2050 sensor-status",
        entryPoints: {
            validate: { calls: replies() },
            get_status: { calls: replies() }
        }
    }]
};
