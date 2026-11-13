// Simulated Docker 19.03.15 `docker info --format '{{json .}}'` output. Shape follows the `docker info` JSON of the
// Docker Engine 19.03 (types.Info: counters, DriverStatus as [key, value] pairs, Plugins, RegistryConfig, Runtimes, Swarm,
// ContainerdCommit/RuncCommit/InitCommit, SecurityOptions ...), on Ubuntu 20.04 with the overlay2 storage driver.
const reply = require("../../replies");

const INFO = {
    ID: "7TRN:IPZB:QYBB:VPBQ:UWIU:ZRDG:2L5R:MK4W:6VNR:X3V6:N6TD:7YHF",
    Containers: 14,
    ContainersRunning: 3,
    ContainersPaused: 0,
    ContainersStopped: 11,
    Images: 21,
    Driver: "overlay2",
    DriverStatus: [["Backing Filesystem", "extfs"], ["Supports d_type", "true"], ["Native Overlay Diff", "true"]],
    SystemStatus: null,
    Plugins: {
        Volume: ["local"],
        Network: ["bridge", "host", "ipvlan", "macvlan", "null", "overlay"],
        Authorization: null,
        Log: ["awslogs", "fluentd", "gcplogs", "gelf", "journald", "json-file", "local", "logentries", "splunk", "syslog"]
    },
    MemoryLimit: true,
    SwapLimit: false,
    KernelMemory: true,
    KernelMemoryTCP: true,
    CpuCfsPeriod: true,
    CpuCfsQuota: true,
    CPUShares: true,
    CPUSet: true,
    PidsLimit: true,
    IPv4Forwarding: true,
    BridgeNfIptables: true,
    BridgeNfIp6tables: true,
    Debug: false,
    NFd: 33,
    OomKillDisable: true,
    NGoroutines: 52,
    SystemTime: "2024-03-12T10:41:07.123456789Z",
    LoggingDriver: "json-file",
    CgroupDriver: "cgroupfs",
    NEventsListener: 0,
    KernelVersion: "5.4.0-170-generic",
    OperatingSystem: "Ubuntu 20.04.6 LTS",
    OSType: "linux",
    Architecture: "x86_64",
    IndexServerAddress: "https://index.docker.io/v1/",
    RegistryConfig: {
        AllowNondistributableArtifactsCIDRs: [],
        AllowNondistributableArtifactsHostnames: [],
        InsecureRegistryCIDRs: ["127.0.0.0/8"],
        IndexConfigs: { "docker.io": { Name: "docker.io", Mirrors: [], Secure: true, Official: true } },
        Mirrors: []
    },
    NCPU: 4,
    MemTotal: 8340316160,
    GenericResources: null,
    DockerRootDir: "/var/lib/docker",
    HttpProxy: "",
    HttpsProxy: "",
    NoProxy: "",
    Name: "docker-host-01",
    Labels: [],
    ExperimentalBuild: false,
    ServerVersion: "19.03.15",
    ClusterStore: "",
    ClusterAdvertise: "",
    Runtimes: { runc: { path: "runc" }, nvidia: { path: "nvidia-container-runtime" }, runsc: { path: "/usr/local/bin/runsc" } },
    DefaultRuntime: "runc",
    Swarm: { NodeID: "", NodeAddr: "", LocalNodeState: "inactive", ControlAvailable: false, Error: "", RemoteManagers: null },
    LiveRestoreEnabled: false,
    Isolation: "",
    InitBinary: "docker-init",
    ContainerdCommit: { ID: "ea765aba0d05254012b0b9e595e995c09186427f", Expected: "ea765aba0d05254012b0b9e595e995c09186427f" },
    RuncCommit: { ID: "v1.0.0-rc10-0-gdc9208a", Expected: "v1.0.0-rc10-0-gdc9208a" },
    InitCommit: { ID: "fec3683", Expected: "fec3683" },
    SecurityOptions: ["name=apparmor", "name=seccomp,profile=default"],
    Warnings: ["WARNING: No swap limit support"]
};

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: "docker info --format '{{json .}}'", reply: reply.ssh(JSON.stringify(INFO) + "\n") });

module.exports = {
    cases: [{
        name: "docker 19.03.15",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
