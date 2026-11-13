// Simulated web server replies for the generic HTTP monitoring template. The driver ships with an example
// configuration: two GET https://domotz.com/features.php probes, one extracting the <h1> text with a regular
// expression and one with the "h1" query selector. A web server answers 200 with a text/html page, so the page
// below is an ordinary HTML document with one <h1> line (the regular expression is line oriented). There is no
// companion .json, so no expected_variables are checked. The clock is fixed, so "Elapsed" is 0.
const reply = require("../../replies");

const PAGE = [
    "<!DOCTYPE html>",
    "<html lang=\"en\"><head><meta charset=\"utf-8\"><title>Features | Domotz</title></head>",
    "<body>",
    "<header><nav><a href=\"/\">Home</a></nav></header>",
    "<h1 class=\"page-title\">Network Monitoring Features</h1>",
    "<p>Monitor every device on the network.</p>",
    "</body></html>"
].join("\n");

const probe = () => ({ kind: "http", method: "get", host: "domotz.com", protocol: "https", target: "/features.php", reply: reply.http(200, PAGE, { "content-type": "text/html; charset=UTF-8" }) });

module.exports = {
    cases: [{
        name: "example configuration",
        entryPoints: { validate: { calls: [] }, get_status: { calls: [probe(), probe()] } }
    }]
};
