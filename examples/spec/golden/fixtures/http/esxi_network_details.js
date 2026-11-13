// Simulated VMware ESXi 8.0 standalone host replies. Shape follows the vSphere Web Services SDK (vim25) SOAP API: LoginResponse,
// CreateContainerViewResponse, FetchResponse and RetrievePropertiesResponse envelopes with the property types of the vSphere API
// reference. All posts go to /sdk; the driver keeps the vmware_soap_session cookie with jar: true (no header to prove).
const reply = require("../../replies");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const envelope = (inner) => '<?xml version="1.0" encoding="UTF-8"?>\n<soapenv:Envelope xmlns:soapenc="http://schemas.xmlsoap.org/soap/encoding/" ' +
    'xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:xsd="http://www.w3.org/2001/XMLSchema" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Body>' + inner + "</soapenv:Body></soapenv:Envelope>";

const SESSION = "52b6e7a1-3f0c-9d2e-8a41-6c7d5e0f1b23";
const COOKIE = 'vmware_soap_session="' + SESSION + '"; Path=/; HttpOnly; Secure;';

// RetrieveProperties reply: each object is { obj, type, props: [[name, xsiType, innerXml]] }.
const retrieveReply = (objects) => envelope('<RetrievePropertiesResponse xmlns="urn:vim25">' + objects.map((o) =>
    '<returnval><obj type="' + o.type + '">' + o.obj + "</obj>" + o.props.map((p) =>
        "<propSet><name>" + p[0] + '</name><val xsi:type="' + p[1] + '">' + p[2] + "</val></propSet>").join("") + "</returnval>").join("") +
    "</RetrievePropertiesResponse>");

const login = {
    kind: "http", method: "post", target: "/sdk", body: /<vim25:Login>/,
    reply: reply.http(200, envelope('<LoginResponse xmlns="urn:vim25"><returnval><key>' + SESSION + "</key><userName>root</userName>" +
        "<fullName>Administrator</fullName><loginTime>2026-10-27T08:00:00.123456Z</loginTime><lastActiveTime>2026-10-27T08:00:00.123456Z</lastActiveTime>" +
        "<locale>en</locale><messageLocale>en</messageLocale><extensionSession>false</extensionSession><ipAddress>192.168.1.50</ipAddress>" +
        "<userAgent></userAgent><callCount>0</callCount></returnval></LoginResponse>"), { "set-cookie": [COOKIE] })
};

const CONTAINER = "session[" + SESSION + "]52c1d9f0-7a55-4be3-2f19-0d6e8c4a7b31";
const containerView = (folder, type) => ({
    kind: "http", method: "post", target: "/sdk",
    body: new RegExp("CreateContainerView[\\s\\S]*" + esc(folder) + "[\\s\\S]*<type>" + type + "</type>"),
    reply: reply.http(200, envelope('<CreateContainerViewResponse xmlns="urn:vim25"><returnval type="ContainerView">' + CONTAINER +
        "</returnval></CreateContainerViewResponse>"))
});

const fetchView = (type, refs) => ({
    kind: "http", method: "post", target: "/sdk",
    body: new RegExp("<Fetch [\\s\\S]*" + esc(CONTAINER)),
    reply: reply.http(200, envelope('<FetchResponse xmlns="urn:vim25"><returnval xsi:type="ArrayOfManagedObjectReference">' + refs.map((r) =>
        '<ManagedObjectReference type="' + type + '" xsi:type="ManagedObjectReference">' + r + "</ManagedObjectReference>").join("") +
        "</returnval></FetchResponse>"))
});

const NETS = [
    { ref: "HaNetwork-VM Network", name: "VM Network", status: "green", vms: ["1", "2"] },
    { ref: "HaNetwork-Isolated Lab", name: "Isolated Lab", status: "yellow", vms: ["3"] },
    { ref: "HaNetwork-Backup", name: "Backup", status: "green", vms: ["2", "4"] }
];
const VM_NAMES = { 1: "web-01", 2: "db-01", 3: "build-agent", 4: "backup-proxy" };

const netProps = (n) => [
    ["name", "xsd:string", n.name],
    ["summary.accessible", "xsd:boolean", "true"],
    ["vm", "ArrayOfManagedObjectReference", n.vms.map((v) => '<ManagedObjectReference type="VirtualMachine" xsi:type="ManagedObjectReference">' + v + "</ManagedObjectReference>").join("")],
    ["overallStatus", "ManagedEntityStatus", n.status]
];

// One RetrieveProperties per network, whose objectSets are exactly that network's VMs.
const vmNamesCall = (vms) => ({
    kind: "http", method: "post", target: "/sdk",
    body: new RegExp(esc("</vim25:propSet>" + vms.map((v) => '<vim25:objectSet>   <vim25:obj type="VirtualMachine">' + v + "</vim25:obj></vim25:objectSet>").join("") + "   </vim25:specSet>")),
    reply: reply.http(200, retrieveReply(vms.map((v) => ({ obj: v, type: "VirtualMachine", props: [["name", "xsd:string", VM_NAMES[v]]] }))))
});

const calls = () => [
    login,
    containerView("ha-folder-network", "Network"),
    fetchView("Network", NETS.map((n) => n.ref)),
    {
        kind: "http", method: "post", target: "/sdk",
        body: new RegExp("<vim25:type>Network</vim25:type>[\\s\\S]*overallStatus[\\s\\S]*" + esc('<vim25:obj type="Network">' + NETS[2].ref + "</vim25:obj>")),
        reply: reply.http(200, retrieveReply(NETS.map((n) => ({ obj: n.ref, type: "Network", props: netProps(n) }))))
    }
].concat(NETS.map((n) => vmNamesCall(n.vms)));

module.exports = {
    cases: [{
        name: "esxi 8.0.0 three networks",
        entryPoints: {
            validate: { calls: [login] },
            get_status: { calls: calls() }
        }
    }]
};
