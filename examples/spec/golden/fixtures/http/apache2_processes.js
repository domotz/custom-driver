// Simulated Apache HTTP Server 2.4.41 (Ubuntu) replies. Shape follows the mod_status HTML page documented at
// https://httpd.apache.org/docs/2.4/mod/mod_status.html (GET /server-status): after the uptime lines and the
// Scoreboard <pre>, a <table border="0"> whose header row is Srv, PID, Acc, M, CPU, SS, Req, Dur, Conn, Child,
// Slot, Client, Protocol, VHost, Request, then one <tr> per worker (mode in <b>, one of _SRWKDCLGI.).
// Rows are emitted on separate lines with no whitespace between cells, as httpd prints them.
const reply = require("../../replies");

const row = (cells) => "<tr>" + cells.map((c, i) => (i === 0 || i === 3 ? "<td><b>" + c + "</b></td>" : (i >= 13 ? "<td nowrap>" + c + "</td>" : "<td>" + c + "</td>"))).join("") + "</tr>";

const HEADER = "<tr><th>Srv</th><th>PID</th><th>Acc</th><th>M</th><th>CPU\n</th><th>SS</th><th>Req</th><th>Dur</th><th>Conn</th><th>Child</th><th>Slot</th><th>Client</th><th>Protocol</th><th>VHost</th><th>Request</th></tr>";

const PAGE = [
    "<!DOCTYPE HTML PUBLIC \"-//W3C//DTD HTML 3.2 Final//EN\">",
    "<html><head><title>Apache Status</title></head><body>",
    "<h1>Apache Server Status for localhost (via 127.0.0.1)</h1>",
    "<dl><dt>Server Version: Apache/2.4.41 (Ubuntu)</dt>",
    "<dt>Server MPM: event</dt></dl>",
    "<pre>Scoreboard Key:\n\"<b><code>_</code></b>\" Waiting for Connection, \"<b><code>W</code></b>\" Sending Reply, \"<b><code>.</code></b>\" Open slot with no current process\n</pre>",
    "<table border=\"0\">" + HEADER,
    row(["0-0", "2412", "0/12/12", "_", "0.20", "35", "0", "412", "0.0", "0.05", "0.05", "192.168.1.20", "http/1.1", "www.example.com:80", "GET /index.html HTTP/1.1"]),
    row(["0-0", "2412", "1/9/9", "W", "0.18", "0", "2", "97", "1.8", "0.03", "0.03", "127.0.0.1", "http/1.1", "localhost:80", "GET /server-status HTTP/1.1"]),
    row(["1-0", "2413", "0/3/3", "K", "0.05", "4", "11", "58", "0.0", "0.01", "0.01", "192.168.1.31", "http/1.1", "www.example.com:80", "POST /api/login HTTP/1.1"]),
    row(["-", "-", "0/0/0", ".", "0.00", "0", "0", "0", "0.0", "0.00", "0.00", "", "", "", ""]),
    "</table>",
    "<hr><table>",
    "<tr><th>Srv</th><td>Child Server number - generation</td></tr>",
    "<tr><th>PID</th><td>OS process ID</td></tr>",
    "</table></body></html>"
].join("\n");

const call = () => [{ kind: "http", method: "get", target: "/server-status", reply: reply.http(200, PAGE, { "content-type": "text/html; charset=ISO-8859-1" }) }];

module.exports = {
    cases: [{ name: "apache 2.4.41 worker table", entryPoints: { validate: { calls: call() }, get_status: { calls: call() } } }]
};
