// Simulated Kubernetes kube-scheduler /metrics reply (v1.28). Shape follows the Prometheus text exposition format 0.0.4 with the
// families documented in the Kubernetes metrics reference: scheduler_schedule_attempts_total{profile,result} (result is
// scheduled, unschedulable or error), rest_client_requests_total{code,host,method} and the client_golang go_* / process_* collectors.
const reply = require("../../replies");

const METRICS = `# HELP go_goroutines Number of goroutines that currently exist.
# TYPE go_goroutines gauge
go_goroutines 64
# HELP go_threads Number of OS threads created.
# TYPE go_threads gauge
go_threads 14
# HELP process_cpu_seconds_total Total user and system CPU time spent in seconds.
# TYPE process_cpu_seconds_total counter
process_cpu_seconds_total 45.67
# HELP process_max_fds Maximum number of open file descriptors.
# TYPE process_max_fds gauge
process_max_fds 1.048576e+06
# HELP process_open_fds Number of open file descriptors.
# TYPE process_open_fds gauge
process_open_fds 22
# HELP process_resident_memory_bytes Resident memory size in bytes.
# TYPE process_resident_memory_bytes gauge
process_resident_memory_bytes 5.5e+07
# HELP process_virtual_memory_bytes Virtual memory size in bytes.
# TYPE process_virtual_memory_bytes gauge
process_virtual_memory_bytes 7.6e+08
# HELP rest_client_requests_total Number of HTTP requests, partitioned by status code, method, and host.
# TYPE rest_client_requests_total counter
rest_client_requests_total{code="200",host="10.0.0.10:6443",method="GET"} 3500
rest_client_requests_total{code="201",host="10.0.0.10:6443",method="POST"} 410
rest_client_requests_total{code="409",host="10.0.0.10:6443",method="PATCH"} 7
rest_client_requests_total{code="500",host="10.0.0.10:6443",method="GET"} 2
# HELP scheduler_schedule_attempts_total [STABLE] Number of attempts to schedule pods, by the result. 'unschedulable' means a pod could not be scheduled, while 'error' means an internal scheduler problem.
# TYPE scheduler_schedule_attempts_total counter
scheduler_schedule_attempts_total{profile="default-scheduler",result="error"} 0
scheduler_schedule_attempts_total{profile="default-scheduler",result="scheduled"} 420
scheduler_schedule_attempts_total{profile="default-scheduler",result="unschedulable"} 15
scheduler_schedule_attempts_total{profile="gpu-scheduler",result="scheduled"} 8
`;

const call = () => ({ kind: "http", method: "get", target: "/metrics", reply: reply.http(200, METRICS) });

module.exports = {
    cases: [{
        name: "scheduler with unschedulable pods and no errors",
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
