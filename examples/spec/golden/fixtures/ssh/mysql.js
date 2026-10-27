// Simulated Debian 10 / MySQL 5.5 output of the driver's combined command (`service mysql status | grep Active:`, `pmap`
// of the pid file's process tail, `mysqladmin ... version`). Shape follows the real outputs captured in spec/mysql_spec.js:
// the systemd "Active:" line, pmap's "total <n>K" line and mysqladmin version's banner, "Server version", "Uptime:" and
// the "Threads: ... Queries per second avg:" status line.
const reply = require("../../replies");

const COMMAND = /^\(service mysql status \| grep Active:\) \|\| echo 'No service found'; .*mysqladmin -u .* version\) \|\| echo 'Cannot run mysqladmin'$/;
const ACTIVE = "   Active: active (running) since Thu 2022-05-19 08:23:29 CEST; 5min ago\n";

const output = (slowQueries) => ACTIVE +
    " total           681660K\n" +
    "mysqladmin  Ver 8.42 Distrib 5.5.62, for debian-linux-gnu on x86_64\n" +
    "Copyright (c) 2000, 2018, Oracle and/or its affiliates. All rights reserved.\n" +
    "\n" +
    "Oracle is a registered trademark of Oracle Corporation and/or its\n" +
    "affiliates. Other names may be trademarks of their respective\n" +
    "owners.\n" +
    "\n" +
    "Server version          5.5.62-0+deb8u1\n" +
    "Protocol version        10\n" +
    "Connection              Localhost via UNIX socket\n" +
    "UNIX socket             /var/run/mysqld/mysqld.sock\n" +
    "Uptime:                 1 day 4 hours 19 min 7 sec\n" +
    "\n" +
    "Threads: 3  Questions: 1150  Slow queries: " + slowQueries + "  Opens: 113  Flush tables: 1  Open tables: 106  Queries per second avg: 3.605\n";

const validateCalls = (out) => [
    { kind: "ssh", method: "sendSSHCommand", target: "service mysql status", reply: reply.ssh(ACTIVE) },
    { kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(out) }
];
const statusCalls = (out) => [{ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(out) }];

module.exports = {
    cases: [
        {
            name: "mysql 5.5 with a slow query",
            entryPoints: {
                validate: { calls: validateCalls(output(1)) },
                get_status: { calls: statusCalls(output(1)) }
            }
        },
        {
            name: "mysql 5.5 without slow queries",
            entryPoints: {
                validate: { calls: validateCalls(output(0)) },
                get_status: { calls: statusCalls(output(0)) }
            }
        }
    ]
};
