// Simulated vCenter 8.0.2 replies. Shape follows the vSphere Automation REST API: POST /api/session
// returns 201 with the session id as a JSON string, GET /api/vcenter/host lists { host, name,
// connection_state, power_state }, and GET /sdk/vim25/8.0.1.0/HostSystem/{moId}/summary returns the
// vim25 HostListSummary (hardware, config.product, runtime, quickStats, overallStatus, host moref).
// memorySize is in bytes, overallMemoryUsage in MB, overallCpuUsage in MHz, uptime in seconds.
const reply = require("../../replies");

const SID = "7e6d5c4b3a291807f6e5d4c3b2a19087";
const GIB = 1024 * 1024 * 1024;

const hostList = [
    { host: "host-12", name: "esx01.lab.local", connection_state: "CONNECTED", power_state: "POWERED_ON" },
    { host: "host-34", name: "esx02.lab.local", connection_state: "DISCONNECTED", power_state: "POWERED_OFF" }
];

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
        runtime: { powerState: "poweredOff", connectionState: "disconnected" },
        quickStats: { overallCpuUsage: 26400, overallMemoryUsage: 32768, uptime: 7380 },
        overallStatus: "red"
    }
};

function calls() {
    const list = [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/vcenter/host", headers: { "vmware-api-session-id": SID }, reply: reply.http(200, hostList) }
    ];
    Object.keys(summaries).forEach((id) => {
        list.push({
            kind: "http", method: "get", target: "/sdk/vim25/8.0.1.0/HostSystem/" + id + "/summary",
            headers: { "vmware-api-session-id": SID }, reply: reply.http(200, summaries[id])
        });
    });
    return list;
}

module.exports = {
    cases: [{
        name: "vcenter 8.0.2 all hosts",
        parameters: { hostId: "ALL" },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
