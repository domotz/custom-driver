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

const mor = (v) => '<ManagedObjectReference type="VirtualMachine" xsi:type="ManagedObjectReference">' + v + "</ManagedObjectReference>";

const vm = (ref, p) => ({
    obj: ref, type: "VirtualMachine", props: [
        ["config.name", "xsd:string", p.name],
        ["runtime.powerState", "VirtualMachinePowerState", p.power],
        ["summary.overallStatus", "ManagedEntityStatus", p.status],
        ["runtime.numMksConnections", "xsd:int", "0"],
        ["config.guestFullName", "xsd:string", p.guestFullName],
        ["guest.guestState", "xsd:string", p.guestState],
        ["summary.config.guestId", "xsd:string", p.guestId],
        ["config.hardware.numCPU", "xsd:int", String(p.cpus)],
        ["summary.quickStats.hostMemoryUsage", "xsd:int", String(p.memUsed)],
        ["config.hardware.memoryMB", "xsd:int", String(p.memMb)],
        ["guest.toolsStatus", "VirtualMachineToolsStatus", p.toolsStatus],
        ["guest.toolsVersionStatus2", "xsd:string", p.toolsVersion],
        ["guest.toolsRunningStatus", "xsd:string", p.toolsRunning],
        ["summary.config.vmPathName", "xsd:string", p.path],
        ["summary.runtime.host", "ManagedObjectReference", "ha-host"],
        ["runtime.connectionState", "VirtualMachineConnectionState", "connected"],
        ["summary.runtime.maxMemoryUsage", "xsd:int", String(p.memMb)],
        ["summary.runtime.maxCpuUsage", "xsd:int", String(p.cpus * 2100)],
        ["config.template", "xsd:boolean", "false"],
        ["summary.config.numEthernetCards", "xsd:int", String(p.nics)],
        ["summary.config.numVirtualDisks", "xsd:int", String(p.disks)]
    ]
});

const VMS = [
    vm("1", { name: "web-01", power: "poweredOn", status: "green", guestFullName: "Ubuntu Linux (64-bit)", guestState: "running", guestId: "ubuntu64Guest", cpus: 2, memUsed: 1024, memMb: 4096, toolsStatus: "toolsOk", toolsVersion: "guestToolsCurrent", toolsRunning: "guestToolsRunning", path: "[datastore1] web-01/web-01.vmx", nics: 1, disks: 1 }),
    vm("2", { name: "db-01", power: "poweredOn", status: "yellow", guestFullName: "Microsoft Windows Server 2022 (64-bit)", guestState: "running", guestId: "windows2019srvNext_64Guest", cpus: 4, memUsed: 6144, memMb: 8192, toolsStatus: "toolsOld", toolsVersion: "guestToolsNeedUpgrade", toolsRunning: "guestToolsRunning", path: "[datastore1] db-01/db-01.vmx", nics: 2, disks: 3 }),
    vm("3", { name: "old-app", power: "poweredOff", status: "gray", guestFullName: "CentOS 7 (64-bit)", guestState: "notRunning", guestId: "centos7_64Guest", cpus: 1, memUsed: 0, memMb: 2048, toolsStatus: "toolsNotRunning", toolsVersion: "guestToolsUnmanaged", toolsRunning: "guestToolsNotRunning", path: "[ssd-fast] old-app/old-app.vmx", nics: 1, disks: 1 })
];

const folderCall = {
    kind: "http", method: "post", target: "/sdk", body: /<vim25:type>Folder<\/vim25:type>[\s\S]*ha-folder-vm/,
    reply: reply.http(200, retrieveReply([{ obj: "ha-folder-vm", type: "Folder", props: [["childEntity", "ArrayOfManagedObjectReference", VMS.map((v) => mor(v.obj)).join("")]] }]))
};

module.exports = {
    cases: [{
        name: "esxi 8.0.0 all vms",
        parameters: { vmID: ["All"] },
        entryPoints: {
            validate: { calls: [login, folderCall] },
            get_status: {
                calls: [
                    login,
                    folderCall,
                    {
                        kind: "http", method: "post", target: "/sdk",
                        body: new RegExp("<vim25:type>VirtualMachine</vim25:type>[\\s\\S]*config\\.name[\\s\\S]*" + esc('<vim25:obj type="VirtualMachine">1</vim25:obj>') + "[\\s\\S]*" +
                            esc('<vim25:obj type="VirtualMachine">2</vim25:obj>') + "[\\s\\S]*" + esc('<vim25:obj type="VirtualMachine">3</vim25:obj>')),
                        reply: reply.http(200, retrieveReply(VMS))
                    }
                ]
            }
        }
    }]
};
