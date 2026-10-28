// Simulated ScreenConnect Server replies. Shape follows the ScreenConnect web server: GET /Script.ashx (port
// 8040, the relay's script endpoint) answers a JavaScript file that embeds the host client settings as JSON,
// including "productVersion":"<major.minor.patch.build>" (e.g. 23.9.10.8817). Versions up to 23.9.7.x are
// vulnerable to CVE-2024-1709/1708.
const reply = require("../../replies");

const script = (version) => "window.SC=window.SC||{};var settings={\"hostName\":\"relay.example.com\",\"productVersion\":\"" + version + "\",\"isLicensed\":true};\nSC.start(settings);\n";

const call = (body) => [{ kind: "http", method: "get", target: "/Script.ashx", reply: reply.http(200, body, { "content-type": "application/javascript" }) }];
const kase = (name, body) => ({ name, entryPoints: { validate: { calls: call(body) }, get_status: { calls: call(body) } } });

module.exports = {
    cases: [
        kase("patched 23.9.10.8817", script("23.9.10.8817")),
        kase("old 22.8.1.8000", script("22.8.1.8000")),
        kase("vulnerable 23.9.7.8804", script("23.9.7.8804"))
    ]
};
