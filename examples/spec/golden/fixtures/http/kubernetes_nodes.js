// Simulated Kubernetes replies. Shapes follow the core/v1 API: NodeList (GET /api/v1/nodes: items[] { metadata { name, labels,
// creationTimestamp }, status { capacity, allocatable, conditions[], addresses[], nodeInfo } }), paginated PodList (GET /api/v1/pods?limit=N:
// metadata.continue token on every page but the last; items[] { metadata, spec.containers[].resources { limits, requests },
// status { phase, hostIP, podIP, startTime, conditions[], containerStatuses[] } }) and EndpointsList (GET /api/v1/endpoints: items[] { metadata.name,
// subsets[].addresses[].ip }). Quantities use the Kubernetes resource format (CPU "250m" or whole cores, memory "16113304Ki", "512Mi").
const reply = require("../../replies");

const cond = (type, status) => ({ type, status, lastHeartbeatTime: "2026-01-15T09:59:00Z", lastTransitionTime: "2025-12-01T10:00:00Z", reason: "KubeletHasSufficientMemory", message: "" });
const nodeConditions = (ready, disk) => [cond("MemoryPressure", "False"), cond("DiskPressure", disk), cond("PIDPressure", "False"), cond("Ready", ready)];
const info = (kubelet) => ({ machineID: "abc", systemUUID: "def", bootID: "ghi", kernelVersion: "5.15.0-91-generic", osImage: "Ubuntu 22.04.3 LTS", containerRuntimeVersion: "containerd://1.7.2", kubeletVersion: kubelet, kubeProxyVersion: kubelet, operatingSystem: "linux", architecture: "amd64" });

const NODES = {
    kind: "NodeList", apiVersion: "v1", metadata: { resourceVersion: "123456" },
    items: [
        {
            metadata: { name: "k8s-master-1", labels: { "kubernetes.io/hostname": "k8s-master-1", "node-role.kubernetes.io/control-plane": "", "node.kubernetes.io/exclude-from-external-load-balancers": "" }, creationTimestamp: "2025-06-01T08:00:00Z", managedFields: [] },
            status: {
                capacity: { cpu: "4", "ephemeral-storage": "102106132Ki", memory: "16113304Ki", pods: "110" },
                allocatable: { cpu: "4", memory: "16010904Ki", pods: "110" },
                conditions: nodeConditions("True", "False"),
                addresses: [{ type: "InternalIP", address: "10.0.0.10" }, { type: "Hostname", address: "k8s-master-1" }],
                nodeInfo: info("v1.28.4"),
                images: []
            }
        },
        {
            metadata: { name: "k8s-worker-1", labels: { "kubernetes.io/hostname": "k8s-worker-1", "node-role.kubernetes.io/worker": "" }, creationTimestamp: "2025-06-02T09:30:00Z" },
            status: {
                capacity: { cpu: "8", memory: "32781092Ki", pods: "110" },
                allocatable: { cpu: "7910m", memory: "32678692Ki", pods: "110" },
                conditions: nodeConditions("True", "True"),
                addresses: [{ type: "InternalIP", address: "10.0.0.11" }, { type: "ExternalIP", address: "203.0.113.11" }, { type: "Hostname", address: "k8s-worker-1" }],
                nodeInfo: info("v1.28.4")
            }
        }
    ]
};

const podCond = (ready) => [
    { type: "Initialized", status: "True" }, { type: "Ready", status: ready }, { type: "ContainersReady", status: ready }, { type: "PodScheduled", status: "True" }
];
const pod = (name, namespace, hostIP, podIP, phase, ready, containers, restarts) => ({
    metadata: { name, namespace, labels: { app: name } },
    spec: { containers },
    status: {
        phase, hostIP, podIP, startTime: "2026-01-10T08:00:00Z", conditions: podCond(ready),
        containerStatuses: containers.map((c, i) => ({ name: c.name, restartCount: restarts[i], ready: ready === "True" }))
    }
});
const ctr = (name, resources) => ({ name, image: "registry.local/" + name + ":1", resources });

const PAGE1 = {
    kind: "PodList", apiVersion: "v1", metadata: { resourceVersion: "123457", continue: "ENCODED-CONTINUE-TOKEN", remainingItemCount: 2 },
    items: [
        pod("kube-apiserver-k8s-master-1", "kube-system", "10.0.0.10", "10.0.0.10", "Running", "True", [ctr("kube-apiserver", { requests: { cpu: "250m" } })], [0]),
        pod("coredns-5dd5756b68-abcde", "kube-system", "10.0.0.10", "10.244.0.2", "Running", "True", [ctr("coredns", { limits: { memory: "170Mi" }, requests: { cpu: "100m", memory: "70Mi" } })], [1])
    ]
};
const PAGE2 = {
    kind: "PodList", apiVersion: "v1", metadata: { resourceVersion: "123457" },
    items: [
        pod("web-1", "default", "10.0.0.11", "10.244.1.5", "Running", "True", [
            ctr("nginx", { limits: { cpu: "1", memory: "1Gi" }, requests: { cpu: "500m", memory: "512Mi" } }),
            ctr("sidecar", { limits: { cpu: "200m", memory: "256Mi" }, requests: { cpu: "100m", memory: "128Mi" } })
        ], [0, 3]),
        pod("crash-1", "apps", "10.0.0.11", "10.244.1.9", "Running", "False", [ctr("app", { requests: { cpu: "1500m", memory: "2Gi" } })], [12])
    ]
};

const ENDPOINTS = {
    kind: "EndpointsList", apiVersion: "v1", metadata: { resourceVersion: "123458" },
    items: [
        { metadata: { name: "kubernetes", namespace: "default" }, subsets: [{ addresses: [{ ip: "10.0.0.10" }], ports: [{ name: "https", port: 6443, protocol: "TCP" }] }] },
        { metadata: { name: "web", namespace: "default" }, subsets: [{ addresses: [{ ip: "10.244.1.5" }], ports: [{ port: 80, protocol: "TCP" }] }] }
    ]
};

const calls = () => [
    { kind: "http", method: "get", target: "/api/v1/nodes", reply: reply.http(200, NODES) },
    { kind: "http", method: "get", target: "/api/v1/pods?limit=1000", reply: reply.http(200, PAGE1) },
    { kind: "http", method: "get", target: "/api/v1/pods?limit=1000&continue=ENCODED-CONTINUE-TOKEN", reply: reply.http(200, PAGE2) },
    { kind: "http", method: "get", target: "/api/v1/endpoints", reply: reply.http(200, ENDPOINTS) }
];

module.exports = {
    cases: [{
        name: "master and worker, paginated pod list, disk pressure on the worker",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
