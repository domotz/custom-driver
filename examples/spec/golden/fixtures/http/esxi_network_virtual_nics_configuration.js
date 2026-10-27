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

const hostCalls = (path, objects) => [
    login,
    containerView("ha-folder-root", "HostSystem"),
    fetchView("HostSystem", ["ha-host"]),
    {
        kind: "http", method: "post", target: "/sdk",
        body: new RegExp("RetrieveProperties[\\s\\S]*" + esc(path) + '[\\s\\S]*type="HostSystem">ha-host<'),
        reply: reply.http(200, retrieveReply(objects))
    }
];
const hostObj = (props) => [{ obj: "ha-host", type: "HostSystem", props }];

const vnic = (device, portgroup, dhcp, ip, mask, mac) => "<HostVirtualNic><device>" + device + "</device><key>key-vim.host.VirtualNic-" + device + "</key>" +
    "<portgroup>" + portgroup + "</portgroup><spec><ip><dhcp>" + dhcp + "</dhcp><ipAddress>" + ip + "</ipAddress><subnetMask>" + mask + "</subnetMask></ip>" +
    "<mac>" + mac + "</mac><portgroup>" + portgroup + "</portgroup><mtu>1500</mtu><tsoEnabled>true</tsoEnabled><netStackInstanceKey>defaultTcpipStack</netStackInstanceKey></spec>" +
    "<port>key-vim.host.PortGroup.Port-33554437</port></HostVirtualNic>";

const calls = () => hostCalls("config.network.vnic", hostObj([
    ["config.network.vnic", "ArrayOfHostVirtualNic",
        vnic("vmk0", "Management Network", "false", "192.168.1.50", "255.255.255.0", "00:50:56:6b:ab:cd") +
        vnic("vmk1", "vMotion", "false", "10.10.10.50", "255.255.255.0", "00:50:56:66:12:34") +
        vnic("vmk2", "Storage", "true", "172.16.5.23", "255.255.254.0", "00:50:56:64:aa:01")]
]));

module.exports = {
    cases: [{
        name: "esxi 8.0.0 three vmkernel nics",
        entryPoints: {
            validate: { calls: [login] },
            get_status: { calls: calls() }
        }
    }]
};
