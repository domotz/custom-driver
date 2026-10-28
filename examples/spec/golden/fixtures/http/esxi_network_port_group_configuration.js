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

const computed = (promisc, nics, teaming) => "<computedPolicy><security><allowPromiscuous>" + promisc + "</allowPromiscuous><macChanges>true</macChanges><forgedTransmits>true</forgedTransmits></security>" +
    "<nicTeaming><policy>" + teaming + "</policy><reversePolicy>true</reversePolicy><notifySwitches>true</notifySwitches><rollingOrder>false</rollingOrder>" +
    "<failureCriteria><checkSpeed>minimum</checkSpeed><speed>10</speed><checkDuplex>false</checkDuplex><fullDuplex>false</fullDuplex>" +
    "<checkErrorPercent>false</checkErrorPercent><percentage>0</percentage><checkBeacon>false</checkBeacon></failureCriteria>" +
    "<nicOrder>" + nics.map((n) => "<activeNic>" + n + "</activeNic>").join("") + "</nicOrder></nicTeaming>" +
    "<offloadPolicy><csumOffload>true</csumOffload><tcpSegmentation>true</tcpSegmentation><zeroCopyXmit>true</zeroCopyXmit></offloadPolicy>" +
    "<shapingPolicy><enabled>false</enabled></shapingPolicy></computedPolicy>";

// spec.policy is empty on a standard port group that inherits everything from its vSwitch.
const portGroup = (name, vlan, vswitch, ports, promisc, nics, teaming) => "<HostPortGroup><key>key-vim.host.PortGroup-" + name + "</key>" + computed(promisc, nics, teaming) +
    "<vswitch>key-vim.host.VirtualSwitch-" + vswitch + "</vswitch>" +
    ports.map((p) => "<port><key>key-vim.host.PortGroup.Port-" + p[0] + "</key><mac>" + p[1] + "</mac><type>" + p[2] + "</type></port>").join("") +
    "<spec><name>" + name + "</name><vlanId>" + vlan + "</vlanId><vswitchName>" + vswitch + "</vswitchName><policy/></spec></HostPortGroup>";

const calls = () => hostCalls("config.network.portgroup", hostObj([
    ["config.network.portgroup", "ArrayOfHostPortGroup",
        portGroup("Management Network", 0, "vSwitch0", [["33554437", "00:50:56:6b:ab:cd", "host"]], "false", ["vmnic0"], "loadbalance_srcid") +
        portGroup("VM Network", 0, "vSwitch0", [["33554439", "00:50:56:a1:00:01", "virtualMachine"], ["33554440", "00:50:56:a1:00:02", "virtualMachine"]], "false", ["vmnic0"], "loadbalance_srcid") +
        portGroup("Storage", 100, "vSwitch1", [], "true", ["vmnic2", "vmnic3"], "loadbalance_ip")]
]));

module.exports = {
    cases: [{
        name: "esxi 8.0.0 three port groups",
        entryPoints: {
            validate: { calls: [login] },
            get_status: { calls: calls() }
        }
    }]
};
