// Simulated vCenter 8.0.2 replies. Shape follows the vSphere Web Services JSON API (vim25 8.0.1.0): POST
// /sdk/vim25/8.0.1.0/SessionManager/SessionManager/Login answers the UserSession and puts the session id in the
// vmware-api-session-id header; GET /sdk/vim25/8.0.1.0/HostSystem/{moId}/summary returns the HostListSummary
// (hardware, config.product, runtime, quickStats, overallStatus). memorySize is in bytes, overallMemoryUsage in MB,
// overallCpuUsage in MHz, uptime in seconds, overallStatus one of gray|green|yellow|red.
const reply = require("../../replies");

const SID = "7e6d5c4b3a291807f6e5d4c3b2a19087";
const GIB = 1024 * 1024 * 1024;

const LOGIN = { _typeName: "UserSession", key: SID, userName: "VSPHERE.LOCAL\\administrator", fullName: "Administrator", loginTime: "2026-01-15T09:59:00.000Z" };

const summaries = {
    "host-12": {
        host: { type: "HostSystem", value: "host-12" },
        hardware: {
            vendor: "Dell Inc.", model: "PowerEdge R650", cpuModel: "Intel(R) Xeon(R) Gold 6338 CPU @ 2.00GHz",
            cpuMhz: 2000, numCpuPkgs: 2, numCpuCores: 64, numCpuThreads: 128, memorySize: 256 * GIB
        },
        config: { name: "esx01.lab.local", product: { fullName: "VMware ESXi 8.0.2 build-22380479", osType: "vmnix-x86", version: "8.0.2" } },
        runtime: { powerState: "poweredOn", connectionState: "connected" },
        quickStats: { overallCpuUsage: 12800, overallMemoryUsage: 131072, uptime: 1209600 },
        overallStatus: "green"
    },
    "host-34": {
        host: { type: "HostSystem", value: "host-34" },
        hardware: {
            vendor: "HPE", model: "ProLiant DL380 Gen10", cpuModel: "Intel(R) Xeon(R) Silver 4214 CPU @ 2.20GHz",
            cpuMhz: 2200, numCpuPkgs: 2, numCpuCores: 24, numCpuThreads: 48, memorySize: 128 * GIB
        },
        config: { name: "esx02.lab.local", product: { fullName: "VMware ESXi 8.0.1 build-21813344", osType: "vmnix-x86", version: "8.0.1" } },
        runtime: { powerState: "poweredOn", connectionState: "connected" },
        quickStats: { overallCpuUsage: 26400, overallMemoryUsage: 119808, uptime: 7380 },
        overallStatus: "yellow"
    }
};

function calls(hostId) {
    return [
        { kind: "http", method: "post", target: "/sdk/vim25/8.0.1.0/SessionManager/SessionManager/Login", reply: reply.http(200, LOGIN, { "vmware-api-session-id": SID, "content-type": "application/json" }) },
        { kind: "http", method: "get", target: "/sdk/vim25/8.0.1.0/HostSystem/" + hostId + "/summary", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, summaries[hostId]) }
    ];
}

module.exports = {
    cases: Object.keys(summaries).map((hostId) => ({
        name: "vcenter 8.0.2 " + summaries[hostId].config.name,
        parameters: { hostId },
        entryPoints: { validate: { calls: calls(hostId) }, get_status: { calls: calls(hostId) } }
    }))
};
