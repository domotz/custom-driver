// Simulated Apache HTTP Server 2.4.41 (Ubuntu) replies. Shape follows the mod_status machine-readable output
// documented at https://httpd.apache.org/docs/2.4/mod/mod_status.html (GET /server-status?auto): a host line
// then "Key: Value" lines (ServerVersion, ServerMPM, Server Built, CurrentTime, RestartTime, ServerUptimeSeconds,
// Load1/5/15, Total Accesses, Total kBytes, Total Duration, CPU*, ReqPerSec, BusyWorkers, IdleWorkers,
// Scoreboard, ...). Numbers below 1 are printed without a leading zero (".75"), a trailing dot is possible
// ("613."), as httpd prints them.
const reply = require("../../replies");

const BUSY = [
    "localhost",
    "ServerVersion: Apache/2.4.41 (Ubuntu)",
    "ServerMPM: event",
    "Server Built: 2023-10-26T13:44:44",
    "CurrentTime: Thursday, 15-Jan-2026 10:00:00 UTC",
    "RestartTime: Thursday, 15-Jan-2026 08:00:00 UTC",
    "ParentServerConfigGeneration: 1",
    "ParentServerMPMGeneration: 0",
    "ServerUptimeSeconds: 7200",
    "ServerUptime: 2 hours",
    "Load1: 0.15",
    "Load5: 0.20",
    "Load15: 0.10",
    "Total Accesses: 1523",
    "Total kBytes: 4310",
    "Total Duration: 987",
    "CPUUser: 1.5",
    "CPUSystem: .75",
    "CPUChildrenUser: 0",
    "CPUChildrenSystem: 0",
    "CPULoad: .03125",
    "Uptime: 7200",
    "ReqPerSec: .211528",
    "BytesPerSec: 613.",
    "BytesPerReq: 2897.9",
    "DurationPerReq: .648063",
    "BusyWorkers: 3",
    "IdleWorkers: 47",
    "Processes: 2",
    "Stopping: 0",
    "ConnsTotal: 4",
    "ConnsAsyncWriting: 0",
    "ConnsAsyncKeepAlive: 1",
    "ConnsAsyncClosing: 0",
    "Scoreboard: __W_KR____C_L_____D_S_I_G_______..................................................................."
].join("\n") + "\n";

const call = (body) => [{ kind: "http", method: "get", target: "/server-status?auto", reply: reply.http(200, body, { "content-type": "text/plain; charset=ISO-8859-1" }) }];

module.exports = {
    cases: [{ name: "apache 2.4.41 event mpm", entryPoints: { validate: { calls: call(BUSY) }, get_status: { calls: call(BUSY) } } }]
};
