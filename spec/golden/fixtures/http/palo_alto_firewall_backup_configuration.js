// Simulated PAN-OS 10.1 XML API replies. Shape follows the PAN-OS XML API: GET/POST /api/?type=keygen answers
// <response status="success"><result><key>API KEY</key></result></response>, and
// /api/?type=export&category=configuration answers the running configuration as one-line XML
// (<config version="10.1.0" ...>), which the driver re-indents.
const reply = require("../../replies");

const KEY = "LUFRPT14MW5xOEo1R09KVlBZNnpnemh0VHRBOWl6TGM9bXcwM3JLRkpSUjFHVlRxeXRHbXhIdz09";
const KEYGEN = "<response status = 'success'><result><key>" + KEY + "</key></result></response>";
const CONFIG = "<config version=\"10.1.0\" urldb=\"paloaltonetworks\" detail-version=\"10.1.0\">" +
    "<mgt-config><users><entry name=\"admin\"><phash>$5$abcdefgh$IjKlMnOpQrStUvWxYz0123456789abcdefghijklmn</phash>" +
    "<permissions><role-based><superuser>yes</superuser></role-based></permissions></entry></users></mgt-config>" +
    "<devices><entry name=\"localhost.localdomain\"><deviceconfig><system><hostname>PA-440-HQ</hostname>" +
    "<ip-address>192.168.1.10</ip-address><dns-setting><servers><primary>9.9.9.9</primary></servers></dns-setting>" +
    "</system></deviceconfig><vsys><entry name=\"vsys1\"><zone><entry name=\"trust\"/><entry name=\"untrust\"/></zone></entry></vsys>" +
    "</entry></devices></config>";

const keygen = { kind: "http", method: "post", target: "/api/?type=keygen", reply: reply.http(200, KEYGEN, { "content-type": "application/xml" }) };
const exportCall = { kind: "http", method: "get", target: "/api/?type=export&category=configuration&key=" + KEY, reply: reply.http(200, CONFIG, { "content-type": "application/xml" }) };

module.exports = {
    cases: [{
        name: "PA-440 10.1.0",
        entryPoints: { validate: { calls: [keygen, exportCall] }, backup: { calls: [keygen, exportCall] } }
    }]
};
