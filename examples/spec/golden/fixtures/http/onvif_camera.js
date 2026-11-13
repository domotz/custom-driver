// Simulated ONVIF camera replies. Shape follows the ONVIF Media service (ver10/media/wsdl): GetProfilesResponse with
// trt:Profiles elements carrying a token attribute and a tt:Name child, GetStreamUriResponse with trt:MediaUri/tt:Uri,
// both posted to /onvif/device_service as SOAP 1.2; the RTSP DESCRIBE exchange (RFC 2326) over port 554: a first
// request answered 401 with a WWW-Authenticate Digest challenge (realm, nonce), a second with the Authorization header
// answered "RTSP/1.0 200 OK" (healthy) or 401 again (credentials or stream refused).
const reply = require("../../replies");

const NS = 'xmlns:SOAP-ENV="http://www.w3.org/2003/05/soap-envelope" xmlns:trt="http://www.onvif.org/ver10/media/wsdl" xmlns:tt="http://www.onvif.org/ver10/schema"';
const soap = (inner) => `<?xml version="1.0" encoding="UTF-8"?><SOAP-ENV:Envelope ${NS}><SOAP-ENV:Body>${inner}</SOAP-ENV:Body></SOAP-ENV:Envelope>`;

const profile = (token, name) => `<trt:Profiles fixed="true" token="${token}"><tt:Name>${name}</tt:Name>` +
    `<tt:VideoSourceConfiguration token="vsc0"><tt:Name>VideoSource</tt:Name><tt:UseCount>2</tt:UseCount><tt:SourceToken>vs0</tt:SourceToken></tt:VideoSourceConfiguration></trt:Profiles>`;

const profiles = soap("<trt:GetProfilesResponse>" + profile("Profile_1", "MainStream") + profile("Profile_2", "SubStream") + "</trt:GetProfilesResponse>");

const streamUri = (uri) => soap(`<trt:GetStreamUriResponse><trt:MediaUri><tt:Uri>${uri}</tt:Uri><tt:InvalidAfterConnect>false</tt:InvalidAfterConnect><tt:InvalidAfterReboot>false</tt:InvalidAfterReboot><tt:Timeout>PT0S</tt:Timeout></trt:MediaUri></trt:GetStreamUriResponse>`);

const URI1 = "rtsp://192.0.2.10:554/stream1";
const URI2 = "rtsp://192.0.2.10:554/stream2";

const challenge = 'RTSP/1.0 401 Unauthorized\r\nCSeq: 1\r\nWWW-Authenticate: Digest realm="IPCAM", nonce="0a1b2c3d4e5f"\r\n\r\n';
const ok = "RTSP/1.0 200 OK\r\nCSeq: 2\r\nContent-Type: application/sdp\r\nContent-Length: 0\r\n\r\n";
const denied = "RTSP/1.0 401 Unauthorized\r\nCSeq: 2\r\nWWW-Authenticate: Digest realm=\"IPCAM\", nonce=\"0a1b2c3d4e5f\"\r\n\r\n";

const soapCall = (body, text) => ({ kind: "http", method: "post", target: "/onvif/device_service", body, reply: reply.http(200, text, { "content-type": "application/soap+xml" }) });
const describe1 = (uri, answer) => ({ kind: "telnet", method: "sendTelnetCommand", target: new RegExp("^DESCRIBE " + uri.replace(/[.]/g, "\\.") + " RTSP/1.0\\r\\nCSeq: 1\\r\\n$"), reply: reply.telnet(answer) });
const describe2 = (uri, answer) => ({ kind: "telnet", method: "sendTelnetCommand", target: new RegExp("^DESCRIBE " + uri.replace(/[.]/g, "\\.") + " RTSP/1.0\\r\\nCSeq: 2\\r\\nAuthorization: Digest .*realm=\"IPCAM\", nonce=\"0a1b2c3d4e5f\""), reply: reply.telnet(answer) });

const calls = () => [
    soapCall(/GetProfiles/, profiles),
    soapCall(/GetStreamUri.*<trt:ProfileToken>Profile_1<\/trt:ProfileToken>/s, streamUri(URI1)),
    soapCall(/GetStreamUri.*<trt:ProfileToken>Profile_2<\/trt:ProfileToken>/s, streamUri(URI2)),
    describe1(URI1, challenge), describe1(URI2, challenge),
    describe2(URI1, ok), describe2(URI2, denied)
];

module.exports = {
    cases: [{
        name: "two profiles, sub stream refused",
        parameters: { profileName: ["All"], onvifPort: 80 },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
