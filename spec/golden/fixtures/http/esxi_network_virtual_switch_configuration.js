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

const policy = (promisc, nics, teaming) => "<policy><security><allowPromiscuous>" + promisc + "</allowPromiscuous><macChanges>true</macChanges><forgedTransmits>true</forgedTransmits></security>" +
    "<shapingPolicy><enabled>false</enabled></shapingPolicy><offloadPolicy><csumOffload>true</csumOffload><tcpSegmentation>true</tcpSegmentation><zeroCopyXmit>true</zeroCopyXmit></offloadPolicy>" +
    "<nicTeaming><policy>" + teaming + "</policy><reversePolicy>true</reversePolicy><notifySwitches>true</notifySwitches><rollingOrder>false</rollingOrder>" +
    "<failureCriteria><checkSpeed>minimum</checkSpeed><speed>10</speed><checkDuplex>false</checkDuplex><fullDuplex>false</fullDuplex>" +
    "<checkErrorPercent>false</checkErrorPercent><percentage>0</percentage><checkBeacon>false</checkBeacon></failureCriteria>" +
    "<nicOrder>" + nics.map((n) => "<activeNic>" + n + "</activeNic>").join("") + "</nicOrder></nicTeaming></policy>";

// HostVirtualSwitch as ESXi returns it: key, name, numPorts, numPortsAvailable, mtu, portgroup[], pnic[] and the spec (numPorts, bridge, policy, mtu).
const vswitch = (name, ports, avail, portgroups, nics, promisc, teaming) => "<HostVirtualSwitch><name>" + name + "</name><key>key-vim.host.VirtualSwitch-" + name + "</key>" +
    "<numPorts>" + ports + "</numPorts><numPortsAvailable>" + avail + "</numPortsAvailable><mtu>1500</mtu>" +
    portgroups.map((p) => "<portgroup>key-vim.host.PortGroup-" + p + "</portgroup>").join("") +
    nics.map((n) => "<pnic>key-vim.host.PhysicalNic-" + n + "</pnic>").join("") +
    "<spec><numPorts>128</numPorts><bridge xsi:type=\"HostVirtualSwitchBondBridge\">" + nics.map((n) => "<nicDevice>" + n + "</nicDevice>").join("") +
    "<beacon><interval>1</interval></beacon><linkDiscoveryProtocolConfig><protocol>cdp</protocol><operation>listen</operation></linkDiscoveryProtocolConfig></bridge>" +
    policy(promisc, nics, teaming) + "<mtu>1500</mtu></spec></HostVirtualSwitch>";

const calls = () => hostCalls("config.network.vswitch", hostObj([
    ["config.network.vswitch", "ArrayOfHostVirtualSwitch",
        vswitch("vSwitch0", 1536, 1519, ["Management Network", "VM Network"], ["vmnic0"], "false", "loadbalance_srcid") +
        vswitch("vSwitch1", 1536, 1530, ["Storage"], ["vmnic2", "vmnic3"], "true", "loadbalance_ip")]
]));

module.exports = {
    cases: [{
        name: "esxi 8.0.0 two standard switches",
        entryPoints: {
            validate: { calls: [login] },
            get_status: { calls: calls() }
        }
    }]
};
