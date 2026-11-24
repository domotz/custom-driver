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

const GB = 1024 * 1024 * 1024;
const DS = [
    { ref: "65013d1a-6f2b8c4e-91aa-b083fee52d10", name: "datastore1", accessible: true, capacity: 893 * GB, free: 612 * GB + 400 * 1024 * 1024, uncommitted: 120 * GB, type: "VMFS", vms: ["1", "2"] },
    { ref: "65013d9c-2e7f10b3-4d5e-b083fee52d10", name: "ssd-fast", accessible: true, capacity: 1862 * GB, free: 1500 * GB, uncommitted: 0, type: "VMFS", vms: ["3"] },
    // an NFS datastore whose server is down: ESXi reports accessible=false, capacity and free space 0, no uncommitted value
    { ref: "6501a7e0-00000000-0000-000000000000", name: "nfs-backup", accessible: false, capacity: 0, free: 0, uncommitted: null, type: "NFS", vms: ["4"] }
];
const VM_NAMES = { 1: "web-01", 2: "db-01", 3: "build-agent", 4: "backup-proxy" };

const dsProps = (d) => [
    ["name", "xsd:string", d.name],
    ["summary.capacity", "xsd:long", String(d.capacity)],
    ["summary.freeSpace", "xsd:long", String(d.free)]
].concat(d.uncommitted === null ? [] : [["summary.uncommitted", "xsd:long", String(d.uncommitted)]]).concat([
    ["summary.url", "xsd:string", "ds:///vmfs/volumes/" + d.ref + "/"],
    ["summary.accessible", "xsd:boolean", String(d.accessible)],
    ["summary.type", "xsd:string", d.type],
    ["host", "ArrayOfDatastoreHostMount", '<DatastoreHostMount><key type="HostSystem">ha-host</key><mountInfo><path>/vmfs/volumes/' + d.ref +
        "</path><accessMode>readWrite</accessMode><mounted>" + d.accessible + "</mounted><accessible>" + d.accessible + "</accessible></mountInfo></DatastoreHostMount>"],
    ["vm", "ArrayOfManagedObjectReference", d.vms.map((v) => '<ManagedObjectReference type="VirtualMachine" xsi:type="ManagedObjectReference">' + v + "</ManagedObjectReference>").join("")]
]);

// The driver asks the VM names of each datastore with one RetrieveProperties whose objectSets are exactly that datastore's VMs.
const vmNamesCall = (vms) => ({
    kind: "http", method: "post", target: "/sdk",
    body: new RegExp(esc("</vim25:propSet>" + vms.map((v) => '<vim25:objectSet>   <vim25:obj type="VirtualMachine">' + v + "</vim25:obj></vim25:objectSet>").join("") + "   </vim25:specSet>")),
    reply: reply.http(200, retrieveReply(vms.map((v) => ({ obj: v, type: "VirtualMachine", props: [["name", "xsd:string", VM_NAMES[v]]] }))))
});

const calls = () => [
    login,
    containerView("ha-folder-datastore", "Datastore"),
    fetchView("Datastore", DS.map((d) => d.ref)),
    {
        kind: "http", method: "post", target: "/sdk",
        body: new RegExp("<vim25:type>Datastore</vim25:type>[\\s\\S]*summary\\.freeSpace[\\s\\S]*" + esc('<vim25:obj type="Datastore">' + DS[2].ref + "</vim25:obj>")),
        reply: reply.http(200, retrieveReply(DS.map((d) => ({ obj: d.ref, type: "Datastore", props: dsProps(d) }))))
    }
].concat(DS.map((d) => vmNamesCall(d.vms)));

module.exports = {
    cases: [{
        name: "esxi 8.0.0 three datastores",
        entryPoints: {
            validate: { calls: [login] },
            get_status: { calls: calls() }
        }
    }]
};
