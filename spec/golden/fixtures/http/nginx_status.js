// Simulated nginx 1.14.0 (Ubuntu) replies. Shape follows ngx_http_stub_status_module
// (http://nginx.org/en/docs/http/ngx_http_stub_status_module.html), as printed by nginx: four lines,
//   "Active connections: 291 " / "server accepts handled requests" / " 16630948 16630948 31070465 " /
//   "Reading: 6 Writing: 179 Waiting: 106 ", each with the trailing space nginx writes. The Server header is
// the nginx version string. Second case: a quiet server with a single-digit connection count.
const reply = require("../../replies");

const status = (active, accepts, handled, requests, reading, writing, waiting) =>
    "Active connections: " + active + " \nserver accepts handled requests\n " + accepts + " " + handled + " " + requests + " \nReading: " + reading + " Writing: " + writing + " Waiting: " + waiting + " \n";

const call = (body) => [{ kind: "http", method: "get", target: "/basic_status", reply: reply.http(200, body, { server: "nginx/1.14.0 (Ubuntu)", "content-type": "text/plain" }) }];

const busy = status(291, 16630948, 16630948, 31070465, 6, 179, 106);
const quiet = status(2, 1200, 1198, 3400, 0, 1, 1);

module.exports = {
    cases: [
        { name: "busy server", entryPoints: { validate: { calls: call(busy) }, get_status: { calls: call(busy) } } },
        { name: "quiet server", entryPoints: { validate: { calls: call(quiet) }, get_status: { calls: call(quiet) } } }
    ]
};
