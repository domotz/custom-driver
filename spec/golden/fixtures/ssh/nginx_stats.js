// Simulated nginx 1.18 on Ubuntu 22.04 (systemd 249). Shapes: `systemctl status nginx` (Loaded/Active/Main PID/Tasks lines,
// parsed by the driver's own grep/awk pipeline, which is why the replies are the pipeline's "id:Label:value" lines),
// `lscpu` filtered by the driver (CPU(s) then Thread(s) per core), nginx.conf and its includes (sed output of the config files),
// `systemctl show nginx` (Key=Value lines) and the per-server access log counters ("<server>:<port>:<id>:<label>:<count>").
// The second server has no request in the last hour, so `echo "" | wc -l` prints 1.
const reply = require("../../replies");

const ssh = (target, out) => ({ kind: "ssh", method: "sendSSHCommand", target, reply: reply.ssh(out) });

const STATUS = [
    "status:Status:active(running)",
    "pid:PID:745",
    "memory:Memory usage:9216K",
    "tasks:Tasks:5",
    "tasks_limit:Tasks limit:4617",
    "up_from:Up from:1710144922date",
    ""
].join("\n");

const NGINX_CONF = [
    "user www-data;",
    "worker_processes auto;",
    "pid /run/nginx.pid;",
    "events {",
    "    worker_connections 768;",
    "}",
    "http {",
    "    sendfile on;",
    "    include /etc/nginx/mime.types;",
    "    include /etc/nginx/sites-enabled/*;",
    "}",
    ""
].join("\n");

const INCLUDES = [
    "types {",
    "    text/html html htm shtml;",
    "    text/css css;",
    "}",
    "server {",
    "    listen 80;",
    "    server_name example.com www.example.com;",
    "    access_log /var/log/nginx/example.com.access.log;",
    "    location / {",
    "        try_files $uri $uri/ =404;",
    "    }",
    "}",
    "server {",
    "    listen 443 ssl;",
    "    listen [::]:443 ssl;",
    "    server_name shop.example.com;",
    "    access_log /var/log/nginx/shop.access.log;",
    "}",
    ""
].join("\n");

const LOGS = [
    "example.com:80:all_requests:All Requests:120",
    "example.com:80:successfull_requests:Successfull Requests:100",
    "example.com:80:redirected_requests:Redirected Requests:12",
    "example.com:80:error_requests:Error Requests:8",
    "shop.example.com:443:all_requests:All Requests:1",
    "shop.example.com:443:successfull_requests:Successfull Requests:0",
    "shop.example.com:443:redirected_requests:Redirected Requests:0",
    "shop.example.com:443:error_requests:Error Requests:0",
    ""
].join("\n");

const SHOW = [
    "Type=forking",
    "Restart=no",
    "MainPID=745",
    "ControlPID=0",
    "ExecMainStatus=0",
    "ExecStart={ path=/usr/sbin/nginx ; argv[]=/usr/sbin/nginx -g daemon on; master_process on; ; ignore_errors=no ; start_time=[Mon 2024-03-11 08:15:22 UTC] ; stop_time=[n/a] ; pid=745 ; code=(null) ; status=0/0 }",
    "MemoryCurrent=8598323",
    "TasksCurrent=5",
    "TasksMax=4617",
    "LimitNOFILE=524288",
    "ActiveState=active",
    "SubState=running",
    "UnitFileState=enabled",
    "FragmentPath=/lib/systemd/system/nginx.service",
    ""
].join("\n");

const VALIDATE_LOGS = [
    "main:all_requests:All Requests:1",
    "main:successfull_requests:Successfull Requests:0",
    "main:redirected_requests:Redirected Requests:0",
    "main:error_requests:Error Requests:0",
    ""
].join("\n");

module.exports = {
    cases: [{
        name: "nginx 1.18 ubuntu 22.04",
        entryPoints: {
            validate: {
                calls: [
                    ssh("sudo systemctl show nginx --no-pager", SHOW),
                    ssh(/^last_hour=.*iovision-redmine\.io\.access\.log/, VALIDATE_LOGS)
                ]
            },
            get_status: {
                calls: [
                    ssh(/^STATUS=\$\(systemctl status nginx\);echo status:Status:/, STATUS),
                    ssh("lscpu | grep -ie '^cpu(s):' -ie '^thread(s) per core:' | awk '{print $NF}'", "4\n2\n"),
                    ssh(/^sudo sed\s+'s\/.*#\.\*\$\/\/' \/etc\/nginx\/nginx\.conf$/, NGINX_CONF),
                    ssh(/^for file in \$\(ls -d\s+\/etc\/nginx\/mime\.types \/etc\/nginx\/sites-enabled\/\* 2>\/dev\/null\); do sudo cat \$file; done/, INCLUDES),
                    ssh(/^last_hour=.*example\.com\.access\.log.*shop\.access\.log/, LOGS),
                    ssh("sudo systemctl show nginx --no-pager", SHOW)
                ]
            }
        }
    }]
};
