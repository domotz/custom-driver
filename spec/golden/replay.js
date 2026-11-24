/**
 * Replay responder for golden fixtures.
 *
 * createReplay(calls) -> { responder, problems() }
 *   calls = [{ kind, method, target, host?, protocol?, headers?, body?, reply }]
 *   target is compared (string equality or RegExp test) with targetOf(call): the URL for http,
 *   the command for ssh/telnet/tcp/winrm, the OID (or OIDs joined by ",") for snmp; ping, mtr and tftp
 *   calls have no target (leave it out).
 *   host, when given, must equal the external device host (D.createExternalDevice).
 *   headers, when given, must each equal the request's header of that name (http only), e.g. to prove
 *   that the token from a login reply is sent on the data calls.
 *   protocol, when given, must equal the request's protocol option (http only; absent means "http", as
 *   remote_pawn_ng device.js buildRequest defaults it).
 *   body, when given, is compared (string equality or RegExp test) with the request body (http only;
 *   an object body is JSON-stringified), e.g. to tell apart SOAP calls that all post to one URL.
 *
 * Each transport call consumes the first unused fixture call that matches it. A call with no match
 * gets no callback (the driver then never reports) and is listed by problems(), as is every
 * fixture call the driver never made.
 */

function targetOf(call) {
    const o = call.options;
    switch (call.kind) {
        case "http":
            return o && (o.url || o.path);
        case "snmp":
            return Array.isArray(o) ? o.join(",") : String(o);
        case "sshCommands":
            return o && Array.isArray(o.commands) ? o.commands.join("\n") : undefined;
        default:
            return o && typeof o === "object" ? o.command : undefined;
    }
}

function matches(expected, call) {
    if (expected.kind !== call.kind || expected.method !== call.method) {
        return false;
    }
    if (expected.host !== undefined && expected.host !== call.host) {
        return false;
    }
    if (expected.headers !== undefined) {
        const sent = (call.options && call.options.headers) || {};
        if (Object.keys(expected.headers).some((name) => sent[name] !== expected.headers[name])) {
            return false;
        }
    }
    if (expected.protocol !== undefined && expected.protocol !== ((call.options && call.options.protocol) || "http")) {
        return false;
    }
    if (expected.body !== undefined && !matchesValue(expected.body, bodyOf(call))) {
        return false;
    }
    const target = targetOf(call);
    return matchesValue(expected.target, target);
}

function matchesValue(expected, actual) {
    return expected instanceof RegExp ? expected.test(String(actual)) : expected === actual;
}

function bodyOf(call) {
    const body = call.options && call.options.body;
    return body !== null && typeof body === "object" ? JSON.stringify(body) : body;
}

function describeCall(call) {
    return call.kind + "." + call.method + (call.host ? " @" + call.host : "") + " " + JSON.stringify(targetOf(call));
}

function createReplay(calls) {
    const used = calls.map(() => false);
    const unexpected = [];
    function responder(call) {
        const i = calls.findIndex((expected, n) => !used[n] && matches(expected, call));
        if (i === -1) {
            unexpected.push(describeCall(call));
            return undefined;
        }
        used[i] = true;
        return calls[i].reply;
    }
    function problems() {
        const found = unexpected.map((c) => "unexpected call " + c);
        calls.forEach((c, n) => {
            if (!used[n]) {
                found.push("expected call never made " + c.kind + "." + c.method + " " + String(c.target));
            }
        });
        return found;
    }
    return { responder, problems };
}

module.exports = { createReplay, targetOf };
