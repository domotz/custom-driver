/**
 * Hostile transport scenarios for the driver robustness net.
 *
 * Each scenario's responder(call) returns the positional callback args for the call kinds used by
 * fake-d.js (http, ssh, sshCommands, telnet, tcp, winrm, snmp, ping, mtr, tls, tftp).
 *
 * Every reply is a shape the production sandbox library for that kind can actually send
 * (remote_pawn_ng/src/..., file:line cited beside each kind below). A scenario with no production
 * analogue for a kind (e.g. an HTTP 404 for winrm) answers that kind with its transport-error
 * shape, the nearest production-possible reply. No shape is invented.
 */

const DEVICE_IP = "192.0.2.10";
const GARBAGE = "%%% unexpected output %%%";

const errorWith = (message, props) => Object.assign(new Error(message), props);

// ---- http: sandbox/library/device.js:544-615 passes the `request` library's (error, response, body)
// straight through. `request` calls back either with an error (response and body undefined) or with a
// response (error null); (null, undefined, undefined) cannot happen, so there is no "missing response".
const httpReply = (statusCode, body) => [null, { statusCode, headers: {}, body }, body];
const httpError = (code, message) => [errorWith(message, { code }), undefined, undefined];

const HTTP = {
    transport: () => httpError("ECONNREFUSED", "connect ECONNREFUSED"),
    auth: () => httpReply(401, "Unauthorized"),
    empty: () => httpReply(200, ""),
    garbage: () => httpReply(200, "<html>not json</html>"),
    timeout: () => httpError("ETIMEDOUT", "ETIMEDOUT")
};

// ---- ssh, sendSSHCommand: sandbox/library/ssh.js:177-191: callback(stdout, null) on success,
// callback(undefined, error) on failure; sshNode rejects with ssh2 Error objects (network_tools/sshNode.js:461).
const SSH = {
    transport: () => [undefined, errorWith("connect ECONNREFUSED", { code: "ECONNREFUSED" })],
    auth: () => [undefined, errorWith("All configured authentication methods failed", { level: "client-authentication" })],
    empty: () => ["", null],
    garbage: () => [GARBAGE, null],
    timeout: () => [undefined, errorWith("Timed out while waiting for handshake", { level: "client-timeout" })]
};

// ---- sshCommands, sendSSHShellSequence: sandbox/library/ssh.js:143-152 (outputTransformer): callback(outputs, error)
// where outputs is ALWAYS an array with one string per command; on failure sshNode.js:170 gives
// output null, so production sends ([], error).
const SSH_COMMANDS = {
    transport: () => [[], errorWith("connect ECONNREFUSED", { code: "ECONNREFUSED" })],
    auth: () => [[], errorWith("All configured authentication methods failed", { level: "client-authentication" })],
    empty: () => [[""], null],
    garbage: () => [[GARBAGE], null],
    timeout: () => [[], errorWith("Timed out while waiting for handshake", { level: "client-timeout" })]
};

// ---- telnet: sandbox/library/telnet.js:44-47 -> callback(result.response, result.error) with
// commands/telnetSend.js:28-29,54-71: response string and error start as "" and "", an "error" event stores the
// Error, and the close event delivers (responseOut, responseErr). A telnet "timeout" event just ends the
// connection, so a timeout is delivered as ("", "").
const TELNET = {
    transport: () => ["", errorWith("connect ECONNREFUSED", { code: "ECONNREFUSED" })],
    auth: null,
    empty: () => ["", ""],
    garbage: () => [GARBAGE, ""],
    timeout: () => ["", ""]
};

// ---- tcp: sandbox/library/tcp.js:43-46 -> callback(result.response, result.error) with commands/tcpRequest.js:76-95:
// success (string, null), socket error (null, Error), timeout (null, "Timeout").
const TCP = {
    transport: () => [null, errorWith("connect ECONNREFUSED", { code: "ECONNREFUSED" })],
    auth: null,
    empty: () => ["", null],
    garbage: () => [GARBAGE, null],
    timeout: () => [null, "Timeout"]
};

// ---- winrm: sandbox/library/winrm.js:21-27 -> callback({ outcome: null, error: error.message }) on a brokered error,
// else callback(result) with commands/device/winrm/cli.js:43-48 giving { outcome: output, error: null } or
// { outcome: null, error: JSON.stringify(err) }; outcome (winrm/go/runner.js:117-122) is
// { exitCode, stdout, stderr, durationMs }. Error codes from winrm/go/runner.js:5-13.
const winrmOutcome = (stdout) => [{ outcome: { exitCode: 0, stdout, stderr: "", durationMs: 12 }, error: null }];
const winrmError = (code, kind) => [{ outcome: null, error: JSON.stringify({ code, kind }) }];
const WINRM = {
    transport: () => winrmError("EWINRM_NETWORK", "network"),
    auth: () => winrmError("EWINRM_AUTH", "auth"),
    empty: () => winrmOutcome(""),
    garbage: () => winrmOutcome(GARBAGE),
    timeout: () => winrmError("EWINRM_TIMEOUT", "timeout")
};

// ---- tls, getTLSCertificate: sandbox/library/device.js:637-679: callback(null, { issuer, expiry, valid, certError })
// or callback({ message }, undefined) (errors are plain { message } objects, including "No TLS certificate found").
const tlsError = (message) => [{ message }, undefined];
const TLS = {
    transport: () => tlsError("connect ECONNREFUSED"),
    auth: null,
    empty: () => [null, { issuer: undefined, expiry: undefined, valid: true, certError: undefined }],
    garbage: () => [null, { issuer: GARBAGE, expiry: "not a date", valid: false, certError: GARBAGE }],
    timeout: () => tlsError("connect ETIMEDOUT")
};

// ---- ping: sandbox/library/device.js:853-866 (D.device.ping): callback(result, null) or callback(null, error);
// result from network_tools/latency/ping.js:148-163 { jitter, avg, packet_loss, min, max, std, samples }
// (null statistics when every probe was lost).
const PING = {
    transport: () => [null, errorWith("Network is unreachable", { code: "ENETUNREACH" })],
    auth: null,
    empty: () => [{ jitter: null, avg: null, packet_loss: 100, min: null, max: null, std: null, samples: [] }, null],
    garbage: () => [{ jitter: -1, avg: -1, packet_loss: -1, min: -1, max: -1, std: -1, samples: [-1] }, null],
    timeout: () => [null, errorWith("Request timed out", { name: "RequestTimedOutError" })]
};

// ---- mtr: sandbox/library/device.js:920-935 (D.device.mtr): callback(result, null) or callback(null, error);
// result documented at device.js:884-906 { target, protocol, cycles, packet_size, hop_count, elapsed_ms, hops[] }.
const mtrResult = (hops) => [{
    target: DEVICE_IP, protocol: "ICMP", cycles: 10, packet_size: 84, hop_count: hops.length, elapsed_ms: null, hops
}, null];
const MTR = {
    transport: () => [null, errorWith("mtr failed", { code: "EMTR" })],
    auth: null,
    empty: () => mtrResult([]),
    // an unresponsive ("blind") hop, device.js:895-902
    garbage: () => mtrResult([{
        ttl: 1, host: null, hostname: null, hosts: [], loss_percent: 100, sent: 10, received: 0, dropped: 10,
        rtt: null, jitter: null, tos: null, extensions: null
    }]),
    timeout: () => [null, errorWith("mtr timed out", { code: "ETIMEDOUT" })]
};

// ---- tftp, D.tftpServer.accept(options, onReady, onUploadEnd): sandbox/library/tftpServer.js:41-48: the first
// callback is onReady(err, host, port): onReady({ message }, undefined, undefined) or onReady(undefined, host, port).
const tftpError = (message) => [{ message }, undefined, undefined];
const tftpReady = () => [undefined, DEVICE_IP, 69];
const TFTP = {
    transport: () => tftpError("ECONNREFUSED"),
    auth: null,
    empty: tftpReady,
    garbage: tftpReady,
    timeout: () => tftpError("ETIMEDOUT")
};

// ---- snmp: sandbox/library/snmp.js:101-157: get/getRaw callback(output, error) with output null on error;
// walk callback(output, error) with the (possibly partial) output object; set callback(output {} , error).
const snmpError = (call, error) => [call.method === "get" || call.method === "getRaw" ? null : {}, error];
function snmpGarbage(call) {
    const oids = Array.isArray(call.options) ? call.options : [];
    const out = {};
    if (call.method === "set") {
        return [{}, null];
    }
    if (call.method === "walk") {
        out[call.options + ".1"] = "garbage";
        return [out, null];
    }
    oids.forEach((oid) => {
        out[oid] = call.method === "getRaw" ? { type: 4, value: "garbage" } : "garbage";
    });
    return [out, null];
}
const SNMP = {
    transport: (call) => snmpError(call, errorWith("Request timed out", { name: "RequestTimedOutError" })),
    auth: (call) => snmpError(call, errorWith("Authentication failure", { name: "ResponseInvalidError" })),
    empty: () => [{}, null],
    garbage: snmpGarbage,
    timeout: (call) => snmpError(call, errorWith("Request timed out", { name: "RequestTimedOutError" }))
};

const TABLES = {
    http: HTTP, ssh: SSH, sshCommands: SSH_COMMANDS, telnet: TELNET, tcp: TCP, winrm: WINRM,
    tls: TLS, ping: PING, mtr: MTR, tftp: TFTP, snmp: SNMP
};

function reply(call, slot, fallbackSlot) {
    const table = TABLES[call.kind];
    const fn = table[slot] || table[fallbackSlot];
    return fn(call);
}

const transportError = (call) => reply(call, "transport");
// A kind with no authentication step answers with its transport error.
const authRejected = (call) => reply(call, "auth", "transport");
const emptySuccess = (call) => reply(call, "empty");
const garbageSuccess = (call) => reply(call, "garbage");
const timeout = (call) => reply(call, "timeout");
// No production kind calls back without either an error or a result; the nearest analogue is the transport error.
const missingResponse = transportError;

const httpStatus = (statusCode) => (call) =>
    call.kind === "http" ? httpReply(statusCode, "<html><body>Error</body></html>") : transportError(call);

const SCENARIOS = [
    { id: "transport-error", describe: "connection refused / unreachable", responder: transportError },
    { id: "auth-rejected", describe: "credentials rejected", responder: authRejected },
    { id: "http-404", describe: "HTTP 404 with an HTML error page", responder: httpStatus(404) },
    { id: "http-500", describe: "HTTP 500 with an HTML error page", responder: httpStatus(500) },
    { id: "empty-success", describe: "success with an empty payload", responder: emptySuccess },
    { id: "garbage-success", describe: "success with unparseable payload", responder: garbageSuccess },
    { id: "missing-response", describe: "no response (production-possible analogue: transport error)", responder: missingResponse },
    { id: "timeout", describe: "operation timed out", responder: timeout }
];

module.exports = { SCENARIOS };
