/**
 * Hostile transport scenarios for the driver robustness net.
 *
 * Each scenario's responder(call) returns the positional callback args for the
 * call kinds used by fake-d.js (http, ssh, sshCommands, telnet, tcp, winrm,
 * snmp, ping, mtr, tls, tftp). Callback arities: http 3, winrm 1, others 2.
 */

const SSH_FAMILY = new Set(["ssh", "sshCommands", "telnet", "tcp"]);
const NO_RESPONSE = new Set(["ping", "mtr"]);

const httpReply = (statusCode, body) => [null, { statusCode, headers: {} }, body];

function transportError(call) {
    if (call.kind === "http") {
        return [new Error("connect ECONNREFUSED"), undefined, undefined];
    }
    if (SSH_FAMILY.has(call.kind)) {
        return [undefined, { code: 255, message: "connect ECONNREFUSED" }];
    }
    if (call.kind === "winrm") {
        return [{ outcome: null, error: "connect ECONNREFUSED" }];
    }
    if (call.kind === "tls" || call.kind === "tftp") {
        return [new Error("ECONNREFUSED"), undefined];
    }
    return [undefined, new Error("Request timed out")];
}

function authRejected(call) {
    if (call.kind === "http") {
        return httpReply(401, "Unauthorized");
    }
    if (SSH_FAMILY.has(call.kind)) {
        return [undefined, { code: 5, message: "All configured authentication methods failed" }];
    }
    if (call.kind === "winrm") {
        return [{ outcome: null, error: "401 Unauthorized" }];
    }
    if (call.kind === "snmp") {
        return [undefined, new Error("Authentication failure")];
    }
    return transportError(call);
}

const httpStatus = (statusCode) => (call) =>
    call.kind === "http" ? httpReply(statusCode, "<html><body>Error</body></html>") : transportError(call);

function emptySuccess(call) {
    if (call.kind === "http") {
        return httpReply(200, "");
    }
    if (SSH_FAMILY.has(call.kind)) {
        return ["", null];
    }
    if (call.kind === "winrm") {
        return [{ outcome: { stdout: "", stderr: "", code: 0 } }];
    }
    if (call.kind === "snmp" || NO_RESPONSE.has(call.kind)) {
        return [{}, null];
    }
    return [null, ""];
}

function garbageSnmp(call) {
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

function garbageSuccess(call) {
    if (call.kind === "http") {
        return httpReply(200, "<html>not json</html>");
    }
    if (SSH_FAMILY.has(call.kind)) {
        return ["%%% unexpected output %%%", null];
    }
    if (call.kind === "winrm") {
        return [{ outcome: { stdout: "%%% unexpected %%%", stderr: "", code: 0 } }];
    }
    if (call.kind === "snmp") {
        return garbageSnmp(call);
    }
    if (NO_RESPONSE.has(call.kind)) {
        return [{ garbage: "%%% unexpected %%%" }, null];
    }
    return [null, "%%% unexpected %%%"];
}

function missingResponse(call) {
    if (call.kind === "http") {
        return [null, undefined, undefined];
    }
    if (call.kind === "winrm") {
        return [{}];
    }
    return [undefined, undefined];
}

function timeout(call) {
    if (call.kind === "http") {
        return [Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" }), undefined, undefined];
    }
    if (SSH_FAMILY.has(call.kind)) {
        return [undefined, { code: "ETIMEDOUT", message: "Timed out" }];
    }
    if (call.kind === "winrm") {
        return [{ outcome: null, error: "ETIMEDOUT" }];
    }
    if (call.kind === "tls" || call.kind === "tftp") {
        return [Object.assign(new Error("ETIMEDOUT"), { code: "ETIMEDOUT" }), undefined];
    }
    return [undefined, new Error("Request timed out")];
}

const SCENARIOS = [
    { id: "transport-error", describe: "connection refused / unreachable", responder: transportError },
    { id: "auth-rejected", describe: "credentials rejected", responder: authRejected },
    { id: "http-404", describe: "HTTP 404 with an HTML error page", responder: httpStatus(404) },
    { id: "http-500", describe: "HTTP 500 with an HTML error page", responder: httpStatus(500) },
    { id: "empty-success", describe: "success with an empty payload", responder: emptySuccess },
    { id: "garbage-success", describe: "success with unparseable payload", responder: garbageSuccess },
    { id: "missing-response", describe: "callback without a response object", responder: missingResponse },
    { id: "timeout", describe: "operation timed out", responder: timeout }
];

module.exports = { SCENARIOS };
