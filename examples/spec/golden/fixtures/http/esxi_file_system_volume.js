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

// HostFileSystemVolumeInfo.mountInfo is an array of HostFileSystemMountInfo, whose own "mountInfo" member is a HostMountInfo
// (path, accessMode, mounted, accessible) next to "volume": the XML therefore nests <mountInfo> inside <mountInfo>.
const mount = (path, mode, mounted, accessible, volume) => "<mountInfo><mountInfo><path>" + path + "</path><accessMode>" + mode + "</accessMode><mounted>" + mounted +
    "</mounted><accessible>" + accessible + "</accessible></mountInfo>" + volume + "<vStorageSupport>vStorageUnsupported</vStorageSupport></mountInfo>";

const vmfs = '<volume xsi:type="HostVmfsVolume"><type>VMFS</type><name>datastore1</name><capacity>958831968256</capacity><blockSizeMb>1</blockSizeMb>' +
    "<blockSize>1048576</blockSize><unmapGranularity>1048576</unmapGranularity><unmapPriority>low</unmapPriority><maxBlocks>62914560</maxBlocks>" +
    "<majorVersion>6</majorVersion><version>6.82</version><uuid>65013d1a-6f2b8c4e-91aa-b083fee52d10</uuid>" +
    "<extent><diskName>naa.600508b1001c3a2f9d41d5e8a1f7c9b4</diskName><partition>1</partition></extent><vmfsUpgradable>false</vmfsUpgradable>" +
    "<forceMountedInfo><persistent>false</persistent><mounted>false</mounted></forceMountedInfo><ssd>false</ssd><local>true</local></volume>";

const vmfsSsd = '<volume xsi:type="HostVmfsVolume"><type>VMFS</type><name>ssd-fast</name><capacity>1999844147200</capacity><blockSizeMb>1</blockSizeMb>' +
    "<blockSize>1048576</blockSize><maxBlocks>62914560</maxBlocks><majorVersion>5</majorVersion><version>5.81</version>" +
    "<uuid>65013d9c-2e7f10b3-4d5e-b083fee52d10</uuid><extent><diskName>naa.5002538e40a3b1c7</diskName><partition>3</partition></extent>" +
    "<vmfsUpgradable>true</vmfsUpgradable><ssd>true</ssd><local>true</local></volume>";

const nfs = '<volume xsi:type="HostNasVolume"><type>NFS</type><name>nfs-backup</name><capacity>0</capacity><remoteHost>192.168.1.80</remoteHost>' +
    "<remotePath>/export/backup</remotePath><userName></userName><remoteHostNames>192.168.1.80</remoteHostNames><securityType>AUTH_SYS</securityType></volume>";

const bootbank = '<volume xsi:type="HostLocalFileSystemVolume"><type>OTHER</type><name>BOOTBANK1</name><capacity>4293918720</capacity><device>mpx.vmhba32:C0:T0:L0:5</device></volume>';

const calls = () => hostCalls("config.fileSystemVolume", hostObj([
    ["config.fileSystemVolume", "HostFileSystemVolumeInfo",
        "<volumeTypeList>VMFS</volumeTypeList><volumeTypeList>NFS</volumeTypeList><volumeTypeList>OTHER</volumeTypeList>" +
        mount("/vmfs/volumes/65013d1a-6f2b8c4e-91aa-b083fee52d10", "readWrite", "true", "true", vmfs) +
        mount("/vmfs/volumes/65013d9c-2e7f10b3-4d5e-b083fee52d10", "readWrite", "true", "true", vmfsSsd) +
        mount("/vmfs/volumes/6501a7e0-00000000-0000-000000000000", "readOnly", "false", "false", nfs) +
        mount("/vmfs/volumes/2c1b7e11-5a0d3f9e-8d2c-b083fee52d10", "readOnly", "true", "true", bootbank)]
]));

module.exports = {
    cases: [{
        name: "esxi 8.0.0 four volumes",
        entryPoints: {
            validate: { calls: [login] },
            get_status: { calls: calls() }
        }
    }]
};
