// Simulated plain HTTP(S) servers. Shape follows the `request` library response the sandbox hands to the
// callback ((error, response, body), response.statusCode and, with `time: true`, response.elapsedTime in ms).
// One healthy site, one that answers 503 and one given without protocol.
const reply = require("../../replies");

const withTime = (statusCode, elapsedTime, body) => {
    const r = reply.http(statusCode, body, { "content-type": "text/html" });
    r[1].elapsedTime = elapsedTime;
    return r;
};

const URLS = ["https://www.example.com/status", "http://shop.example.org:8080/health", "intranet.example.net"];

const calls = [
    { kind: "http", method: "get", host: "www.example.com", protocol: "https", target: "/status", reply: withTime(200, 183, "<html>OK</html>") },
    { kind: "http", method: "get", host: "shop.example.org", protocol: "http", target: "/health", reply: withTime(503, 1250, "Service Unavailable") },
    { kind: "http", method: "get", host: "intranet.example.net", protocol: "http", target: "/", reply: withTime(200, 42, "<html>Intranet</html>") }
];

module.exports = {
    cases: [{
        name: "three sites, one unavailable",
        parameters: { urls: URLS },
        entryPoints: {
            validate: { calls },
            get_status: { calls }
        }
    }]
};
