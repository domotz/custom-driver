// Simulated Kubernetes replies. Shapes follow: kube-state-metrics /metrics (Prometheus text exposition 0.0.4;
// kube_<object>_created{labels} <unix creation time> gauges), the core/v1 ComponentStatusList (GET /api/v1/componentstatuses:
// { kind, apiVersion, metadata, items: [ { metadata.name, conditions: [ { type: "Healthy", status, message | error } ] } ] }) and the
// API server verbose health endpoints /livez?verbose and /readyz?verbose (one "[+]name ok" line per passing check, then
// "livez check passed" / "readyz check passed"). A failing check would turn the endpoint into HTTP 500, which the driver reports as
// a failure, so both verbose replies are all-passing; the scheduler component status is "False", as on kubeadm clusters
// whose scheduler health port is closed. The cluster has no StatefulSet (the family header is there, no series).
const reply = require("../../replies");

const METRICS = `# HELP kube_cronjob_created Unix creation timestamp
# TYPE kube_cronjob_created gauge
kube_cronjob_created{namespace="default",cronjob="backup"} 1.7e+09
kube_cronjob_created{namespace="ops",cronjob="cleanup"} 1.71e+09
# HELP kube_deployment_created Unix creation timestamp
# TYPE kube_deployment_created gauge
kube_deployment_created{namespace="default",deployment="web"} 1.7e+09
kube_deployment_created{namespace="kube-system",deployment="coredns"} 1.69e+09
kube_deployment_created{namespace="default",deployment="api"} 1.705e+09
# HELP kube_endpoint_created Unix creation timestamp
# TYPE kube_endpoint_created gauge
kube_endpoint_created{namespace="default",endpoint="kubernetes"} 1.69e+09
# HELP kube_job_created Unix creation timestamp
# TYPE kube_job_created gauge
kube_job_created{namespace="default",job_name="backup-28000000"} 1.72e+09
# HELP kube_service_created Unix creation timestamp
# TYPE kube_service_created gauge
kube_service_created{namespace="default",service="kubernetes"} 1.69e+09
kube_service_created{namespace="default",service="web"} 1.7e+09
# HELP kube_namespace_created Unix creation timestamp
# TYPE kube_namespace_created gauge
kube_namespace_created{namespace="default"} 1.69e+09
kube_namespace_created{namespace="kube-system"} 1.69e+09
kube_namespace_created{namespace="ops"} 1.7e+09
# HELP kube_node_created Unix creation timestamp
# TYPE kube_node_created gauge
kube_node_created{node="k8s-master-1"} 1.69e+09
kube_node_created{node="k8s-worker-1"} 1.691e+09
# HELP kube_statefulset_created Unix creation timestamp
# TYPE kube_statefulset_created gauge
`;

const STATUSES = {
    kind: "ComponentStatusList",
    apiVersion: "v1",
    metadata: {},
    items: [
        { metadata: { name: "controller-manager", creationTimestamp: null }, conditions: [{ type: "Healthy", status: "True", message: "ok" }] },
        { metadata: { name: "scheduler", creationTimestamp: null }, conditions: [{ type: "Healthy", status: "False", error: "Get \"https://127.0.0.1:10259/healthz\": dial tcp 127.0.0.1:10259: connect: connection refused" }] },
        { metadata: { name: "etcd-0", creationTimestamp: null }, conditions: [{ type: "Healthy", status: "True", message: "{\"health\":\"true\",\"reason\":\"\"}" }] }
    ]
};

const LIVEZ = `[+]ping ok
[+]log ok
[+]etcd ok
[+]poststarthook/start-kube-apiserver-admission-initializer ok
[+]poststarthook/generic-apiserver-start-informers ok
livez check passed
`;
const READYZ = `[+]ping ok
[+]log ok
[+]etcd ok
[+]informer-sync ok
[+]poststarthook/start-kube-apiserver-admission-initializer ok
[+]shutdown ok
readyz check passed
`;

const calls = () => [
    { kind: "http", method: "get", target: "/metrics", reply: reply.http(200, METRICS) },
    { kind: "http", method: "get", target: "/api/v1/componentstatuses", reply: reply.http(200, STATUSES) },
    { kind: "http", method: "get", target: "/livez?verbose", reply: reply.http(200, LIVEZ) },
    { kind: "http", method: "get", target: "/readyz?verbose", reply: reply.http(200, READYZ) }
];

module.exports = {
    cases: [{
        name: "healthy api server, scheduler component status false",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
