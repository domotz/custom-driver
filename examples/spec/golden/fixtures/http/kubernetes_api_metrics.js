// Simulated Kubernetes kube-apiserver /metrics reply (v1.28). Shape follows the Prometheus text exposition format 0.0.4
// ("# HELP", "# TYPE", then name{label="value",...} value lines) with the metric families the kube-apiserver documents in the
// Kubernetes metrics reference: apiserver_request_total{code,verb,resource,...}, rest_client_requests_total{code,host,method},
// authenticated_user_requests{username}, authentication_attempts{result}, apiserver_current_inflight_requests{request_kind},
// workqueue_adds_total / workqueue_depth{name}, the go_* and process_* client_golang collectors and grpc client counters.
// Zero-valued series (apiserver_request_terminations_total, a workqueue with depth 0) must be reported as 0.
const reply = require("../../replies");

const METRICS = `# HELP apiserver_current_inflight_requests [STABLE] Maximal number of currently used inflight request limit of this apiserver per request kind in last second.
# TYPE apiserver_current_inflight_requests gauge
apiserver_current_inflight_requests{request_kind="mutating"} 2
apiserver_current_inflight_requests{request_kind="readOnly"} 7
# HELP apiserver_request_terminations_total [ALPHA] Number of requests which apiserver terminated in self-defense.
# TYPE apiserver_request_terminations_total counter
apiserver_request_terminations_total{code="429",component="apiserver",group="",resource="",scope="",subresource="",verb="",version=""} 0
# HELP apiserver_request_total [STABLE] Counter of apiserver requests broken out for each verb, dry run value, group, version, resource, scope, component, and HTTP response code.
# TYPE apiserver_request_total counter
apiserver_request_total{code="0",component="apiserver",dry_run="",group="",resource="pods",scope="resource",subresource="exec",verb="CONNECT",version="v1"} 3
apiserver_request_total{code="200",component="apiserver",dry_run="",group="",resource="pods",scope="namespace",subresource="",verb="LIST",version="v1"} 1200
apiserver_request_total{code="200",component="apiserver",dry_run="",group="",resource="nodes",scope="resource",subresource="",verb="GET",version="v1"} 340
apiserver_request_total{code="201",component="apiserver",dry_run="",group="",resource="pods",scope="resource",subresource="binding",verb="POST",version="v1"} 60
apiserver_request_total{code="301",component="apiserver",dry_run="",group="",resource="",scope="",subresource="",verb="GET",version=""} 4
apiserver_request_total{code="404",component="apiserver",dry_run="",group="",resource="configmaps",scope="resource",subresource="",verb="GET",version="v1"} 25
apiserver_request_total{code="409",component="apiserver",dry_run="",group="",resource="pods",scope="resource",subresource="",verb="PUT",version="v1"} 5
apiserver_request_total{code="500",component="apiserver",dry_run="",group="",resource="pods",scope="resource",subresource="",verb="GET",version="v1"} 2
apiserver_request_total{code="503",component="apiserver",dry_run="",group="",resource="",scope="",subresource="",verb="GET",version=""} 1
# HELP apiserver_tls_handshake_errors_total [ALPHA] Number of requests dropped with 'TLS handshake error from' error
# TYPE apiserver_tls_handshake_errors_total counter
apiserver_tls_handshake_errors_total 6
# HELP authenticated_user_requests [ALPHA] Counter of authenticated requests broken out by username.
# TYPE authenticated_user_requests counter
authenticated_user_requests{username="system:kube-scheduler"} 5400
authenticated_user_requests{username="other"} 120
# HELP authentication_attempts [ALPHA] Counter of authenticated attempts.
# TYPE authentication_attempts counter
authentication_attempts{result="error"} 3
authentication_attempts{result="success"} 9876
# HELP go_goroutines Number of goroutines that currently exist.
# TYPE go_goroutines gauge
go_goroutines 215
# HELP go_info Information about the Go environment.
# TYPE go_info gauge
go_info{version="go1.20.10"} 1
# HELP go_threads Number of OS threads created.
# TYPE go_threads gauge
go_threads 28
# HELP grpc_client_msg_received_total Total number of RPC stream messages received by the client.
# TYPE grpc_client_msg_received_total counter
grpc_client_msg_received_total{grpc_method="Range",grpc_service="etcdserverpb.KV",grpc_type="unary"} 800
grpc_client_msg_received_total{grpc_method="Watch",grpc_service="etcdserverpb.Watch",grpc_type="bidi_stream"} 150
# HELP grpc_client_msg_sent_total Total number of gRPC stream messages sent by the client.
# TYPE grpc_client_msg_sent_total counter
grpc_client_msg_sent_total{grpc_method="Range",grpc_service="etcdserverpb.KV",grpc_type="unary"} 800
grpc_client_msg_sent_total{grpc_method="Watch",grpc_service="etcdserverpb.Watch",grpc_type="bidi_stream"} 90
# HELP grpc_client_started_total Total number of RPCs started on the client.
# TYPE grpc_client_started_total counter
grpc_client_started_total{grpc_method="Range",grpc_service="etcdserverpb.KV",grpc_type="unary"} 800
grpc_client_started_total{grpc_method="Watch",grpc_service="etcdserverpb.Watch",grpc_type="bidi_stream"} 30
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 1234.56
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
# HELP rest_client_requests_total Number of HTTP requests, partitioned by status code, method, and host.
# TYPE rest_client_requests_total counter
rest_client_requests_total{code="200",host="127.0.0.1:6443",method="GET"} 700
rest_client_requests_total{code="200",host="127.0.0.1:6443",method="PUT"} 20
rest_client_requests_total{code="404",host="127.0.0.1:6443",method="GET"} 9
rest_client_requests_total{code="500",host="127.0.0.1:6443",method="POST"} 1
# HELP workqueue_adds_total [ALPHA] Total number of adds handled by workqueue
# TYPE workqueue_adds_total counter
workqueue_adds_total{name="DynamicCABundle-client-ca-bundle"} 4
workqueue_adds_total{name="APIServiceRegistrationController"} 1520
# HELP workqueue_depth [ALPHA] Current depth of workqueue
# TYPE workqueue_depth gauge
workqueue_depth{name="DynamicCABundle-client-ca-bundle"} 0
workqueue_depth{name="APIServiceRegistrationController"} 3
`;

const call = () => ({ kind: "http", method: "get", target: "/metrics", reply: reply.http(200, METRICS) });

module.exports = {
    cases: [{
        name: "apiserver with 4xx and 5xx responses",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
