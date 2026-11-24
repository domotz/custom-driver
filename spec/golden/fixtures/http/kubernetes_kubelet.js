// Simulated Kubernetes replies. Shapes follow: core/v1 PodList (GET /api/v1/pods: items[] { metadata { name, namespace },
// status { phase, hostIP, containerStatuses[] { name, state { running | waiting | terminated }, lastState { terminated { exitCode, reason } },
// restartCount, ready } } }), core/v1 NodeList (GET /api/v1/nodes: items[].status.addresses[] { type, address }), the cAdvisor
// Prometheus exposition served by the kubelet through the API server proxy (/api/v1/nodes/<node>/proxy/metrics/cadvisor: samples
// carry a trailing millisecond timestamp, a container="" series for the pod cgroup next to one series per container) and the
// kube-apiserver /metrics process_* / go_* collectors (the machine_* gauges come from cAdvisor, not from /metrics, so they are absent there).
const reply = require("../../replies");

const API_METRICS = `# HELP go_goroutines Number of goroutines that currently exist.
# TYPE go_goroutines gauge
go_goroutines 215
# HELP process_max_fds Maximum number of open file descriptors.
# TYPE process_max_fds gauge
process_max_fds 1.048576e+06
# HELP process_open_fds Number of open file descriptors.
# TYPE process_open_fds gauge
process_open_fds 180
# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes 4.5678592e+08
# HELP process_virtual_memory_bytes Virtual memory size in bytes.
# TYPE process_virtual_memory_bytes gauge
process_virtual_memory_bytes 1.4e+09
`;

const node = (name, ip) => ({
    metadata: { name, labels: { "kubernetes.io/hostname": name } },
    status: { addresses: [{ type: "InternalIP", address: ip }, { type: "Hostname", address: name }], conditions: [{ type: "Ready", status: "True" }] }
});
const NODES = { kind: "NodeList", apiVersion: "v1", metadata: { resourceVersion: "123456" }, items: [node("k8s-worker-1", "10.0.0.11"), node("k8s-worker-2", "10.0.0.12")] };

const running = { running: { startedAt: "2026-01-10T08:00:00Z" } };
const pod = (name, namespace, phase, hostIP, containerStatuses) => ({ metadata: { name, namespace }, status: { phase, hostIP, containerStatuses } });
const PODS = {
    kind: "PodList", apiVersion: "v1", metadata: { resourceVersion: "123457" },
    items: [
        pod("web-1", "default", "Running", "10.0.0.11", [
            { name: "nginx", state: running, lastState: { terminated: { exitCode: 1, reason: "Error" } }, restartCount: 2, ready: true },
            { name: "sidecar", state: running, lastState: {}, restartCount: 0, ready: true }
        ]),
        pod("api-1", "default", "Running", "10.0.0.12", [
            { name: "api", state: running, lastState: {}, restartCount: 1, ready: true }
        ]),
        pod("crash-1", "apps", "Running", "10.0.0.12", [
            { name: "app", state: { waiting: { reason: "CrashLoopBackOff" } }, lastState: { terminated: { exitCode: 137, reason: "OOMKilled" } }, restartCount: 12, ready: false }
        ]),
        pod("job-1", "apps", "Succeeded", "10.0.0.11", [
            { name: "job", state: { terminated: { exitCode: 0, reason: "Completed" } }, lastState: {}, restartCount: 0, ready: false }
        ])
    ]
};

// One cAdvisor sample: pod cgroup (container="") or a container, with usage / system / user CPU seconds.
function cadvisor(samples) {
    const labels = (s) => `container="${s.container}",cpu="total",id="/kubepods/burstable/pod-${s.pod}/${s.container || "pod"}",image="${s.container ? "registry.local/" + s.container + ":1" : ""}",name="${s.container ? "c-" + s.pod + "-" + s.container : ""}",namespace="${s.ns}",pod="${s.pod}"`;
    const out = ["# HELP container_cpu_usage_seconds_total Cumulative cpu time consumed by the container in core-seconds",
        "# TYPE container_cpu_usage_seconds_total counter"];
    samples.forEach((s) => out.push(`container_cpu_usage_seconds_total{${labels(s)}} ${s.usage} 1768471800000`));
    out.push("# HELP container_cpu_system_seconds_total Cumulative system cpu time consumed in seconds.", "# TYPE container_cpu_system_seconds_total counter");
    samples.forEach((s) => out.push(`container_cpu_system_seconds_total{${labels(s)}} ${s.system} 1768471800000`));
    out.push("# HELP container_cpu_user_seconds_total Cumulative user cpu time consumed in seconds.", "# TYPE container_cpu_user_seconds_total counter");
    samples.forEach((s) => out.push(`container_cpu_user_seconds_total{${labels(s)}} ${s.user} 1768471800000`));
    return out.join("\n") + "\n";
}
const CADVISOR_1 = cadvisor([
    { ns: "default", pod: "web-1", container: "", usage: 110.5, system: 22.25, user: 88.25 },
    { ns: "default", pod: "web-1", container: "nginx", usage: 100.5, system: 20.25, user: 80.25 },
    { ns: "default", pod: "web-1", container: "sidecar", usage: 10, system: 2, user: 8 },
    { ns: "apps", pod: "job-1", container: "", usage: 5.75, system: 1.25, user: 4.5 },
    { ns: "apps", pod: "job-1", container: "job", usage: 5.75, system: 1.25, user: 4.5 },
    { ns: "kube-system", pod: "kube-proxy-x", container: "kube-proxy", usage: 300, system: 100, user: 200 }
]);
const CADVISOR_2 = cadvisor([
    { ns: "default", pod: "api-1", container: "", usage: 42, system: 12, user: 30 },
    { ns: "default", pod: "api-1", container: "api", usage: 42, system: 12, user: 30 },
    { ns: "apps", pod: "crash-1", container: "", usage: 8.5, system: 3.5, user: 5 },
    { ns: "apps", pod: "crash-1", container: "app", usage: 8.5, system: 3.5, user: 5 }
]);

const calls = () => [
    { kind: "http", method: "get", target: "/metrics", reply: reply.http(200, API_METRICS) },
    { kind: "http", method: "get", target: "/api/v1/pods", reply: reply.http(200, PODS) },
    { kind: "http", method: "get", target: "/api/v1/nodes", reply: reply.http(200, NODES) },
    { kind: "http", method: "get", target: "/api/v1/nodes/k8s-worker-1/proxy/metrics/cadvisor", reply: reply.http(200, CADVISOR_1) },
    { kind: "http", method: "get", target: "/api/v1/nodes/k8s-worker-2/proxy/metrics/cadvisor", reply: reply.http(200, CADVISOR_2) }
];

// A healthy single-node cluster: no container was ever restarted or terminated, so those counts are 0.
const HEALTHY_PODS = {
    kind: "PodList", apiVersion: "v1", metadata: { resourceVersion: "223457" },
    items: [
        pod("web-1", "default", "Running", "10.0.0.11", [
            { name: "nginx", state: running, lastState: {}, restartCount: 0, ready: true }
        ])
    ]
};
const HEALTHY_NODES = { kind: "NodeList", apiVersion: "v1", metadata: { resourceVersion: "223456" }, items: [node("k8s-worker-1", "10.0.0.11")] };
const HEALTHY_CADVISOR = cadvisor([
    { ns: "default", pod: "web-1", container: "", usage: 12.5, system: 2.5, user: 10 },
    { ns: "default", pod: "web-1", container: "nginx", usage: 12.5, system: 2.5, user: 10 }
]);
const healthyCalls = () => [
    { kind: "http", method: "get", target: "/metrics", reply: reply.http(200, API_METRICS) },
    { kind: "http", method: "get", target: "/api/v1/pods", reply: reply.http(200, HEALTHY_PODS) },
    { kind: "http", method: "get", target: "/api/v1/nodes", reply: reply.http(200, HEALTHY_NODES) },
    { kind: "http", method: "get", target: "/api/v1/nodes/k8s-worker-1/proxy/metrics/cadvisor", reply: reply.http(200, HEALTHY_CADVISOR) }
];

module.exports = {
    cases: [{
        name: "two nodes, four pods with a crash looping one",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }, {
        name: "one node, one pod never restarted",
        entryPoints: {
            validate: { calls: healthyCalls() },
            get_status: { calls: healthyCalls() }
        }
    }]
};
