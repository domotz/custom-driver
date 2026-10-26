const { SCENARIOS } = require("./scenarios");

const KINDS = {
    http: { arity: 3, call: { kind: "http", method: "get", options: { url: "/x" } } },
    ssh: { arity: 2, call: { kind: "ssh", method: "sendSSHCommand", options: { command: "ls" } } },
    sshCommands: { arity: 2, call: { kind: "sshCommands", method: "sendSSHCommands", options: { commands: ["ls"] } } },
    telnet: { arity: 2, call: { kind: "telnet", method: "sendTelnetCommand", options: { command: "ls" } } },
    tcp: { arity: 2, call: { kind: "tcp", method: "sendTCPCommand", options: { command: "ls" } } },
    winrm: { arity: 1, call: { kind: "winrm", method: "sendWinRMCommand", options: { command: "dir" } } },
    snmpGet: { arity: 2, call: { kind: "snmp", method: "get", options: ["1.3.6.1.2.1.1.3.0"] } },
    snmpWalk: { arity: 2, call: { kind: "snmp", method: "walk", options: "1.3.6.1.2.1.2" } },
    snmpGetRaw: { arity: 2, call: { kind: "snmp", method: "getRaw", options: ["1.3.6.1.2.1.1.3.0"] } },
    snmpSet: { arity: 2, call: { kind: "snmp", method: "set", options: "1.3.6.1.2.1.1.5.0" } },
    ping: { arity: 2, call: { kind: "ping", method: "ping", options: {} } },
    mtr: { arity: 2, call: { kind: "mtr", method: "mtr", options: {} } },
    tls: { arity: 2, call: { kind: "tls", method: "getTLSCertificate", options: {} } },
    tftp: { arity: 3, call: { kind: "tftp", method: "accept", options: {} } }
};

describe("hostile scenarios", () => {
    it("defines the eight scenarios in order", () => {
        expect(SCENARIOS.map((s) => s.id)).toEqual([
            "transport-error", "auth-rejected", "http-404", "http-500",
            "empty-success", "garbage-success", "missing-response", "timeout"
        ]);
    });

    SCENARIOS.forEach((scenario) => {
        Object.keys(KINDS).forEach((name) => {
            it(scenario.id + " answers " + name + " with the right callback arity", () => {
                const args = scenario.responder(KINDS[name].call);
                expect(Array.isArray(args)).toBe(true);
                expect(args.length).toBe(KINDS[name].arity);
            });
        });
    });

    const find = (id) => SCENARIOS.find((s) => s.id === id);

    it("garbage-success answers every requested SNMP OID", () => {
        const r = find("garbage-success").responder;
        expect(r(KINDS.snmpGet.call)).toEqual([{ "1.3.6.1.2.1.1.3.0": "garbage" }, null]);
        expect(r(KINDS.snmpGetRaw.call)).toEqual([{ "1.3.6.1.2.1.1.3.0": { type: 4, value: "garbage" } }, null]);
        expect(r(KINDS.snmpWalk.call)).toEqual([{ "1.3.6.1.2.1.2.1": "garbage" }, null]);
        expect(r(KINDS.snmpSet.call)).toEqual([{}, null]);
    });

    it("uses the production shapes for http statuses and timeouts", () => {
        expect(find("http-404").responder(KINDS.http.call)[1].statusCode).toBe(404);
        expect(find("http-500").responder(KINDS.http.call)[1].statusCode).toBe(500);
        expect(find("auth-rejected").responder(KINDS.http.call)[1].statusCode).toBe(401);
        expect(find("timeout").responder(KINDS.http.call)[0].code).toBe("ETIMEDOUT");
    });

    const call = (name) => KINDS[name].call;
    const ans = (id, name) => find(id).responder(call(name));

    it("winrm replies are { outcome, error } with exactly one non-null", () => {
        SCENARIOS.forEach((s) => {
            const [r] = s.responder(call("winrm"));
            expect(Object.keys(r).sort()).toEqual(["error", "outcome"]);
            expect((r.outcome === null) !== (r.error === null)).toBe(true);
        });
        const ok = ans("empty-success", "winrm")[0];
        expect(ok.error).toBeNull();
        expect(ok.outcome).toEqual(jasmine.objectContaining({ exitCode: 0, stdout: "", stderr: "" }));
        expect(typeof ans("transport-error", "winrm")[0].error).toBe("string");
    });

    it("sshCommands output is always an array", () => {
        SCENARIOS.forEach((s) => expect(Array.isArray(s.responder(call("sshCommands"))[0])).toBe(true));
        expect(ans("garbage-success", "sshCommands")[0].every((o) => typeof o === "string")).toBe(true);
    });

    it("tls replies are (null, {issuer, expiry, valid, certError}) or ({message}, undefined)", () => {
        ["empty-success", "garbage-success"].forEach((id) => {
            const [err, info] = ans(id, "tls");
            expect(err).toBeNull();
            expect(Object.keys(info).sort()).toEqual(["certError", "expiry", "issuer", "valid"]);
        });
        const [err, info] = ans("transport-error", "tls");
        expect(typeof err.message).toBe("string");
        expect(info).toBeUndefined();
    });

    it("ping is (result, null) or (null, error); mtr likewise", () => {
        SCENARIOS.forEach((s) => ["ping", "mtr"].forEach((k) => {
            const [a, b] = s.responder(call(k));
            expect((a === null) !== (b === null)).toBe(true);
        }));
        expect(Object.keys(ans("empty-success", "ping")[0]).sort())
            .toEqual(["avg", "jitter", "max", "min", "packet_loss", "samples", "std"]);
        expect(Array.isArray(ans("empty-success", "mtr")[0].hops)).toBe(true);
    });

    it("http never calls back without an error and without a response", () => {
        SCENARIOS.forEach((s) => {
            const [err, response] = s.responder(call("http"));
            expect(err === null && response === undefined).toBe(false);
            expect(err !== null || response !== undefined).toBe(true);
        });
        expect(ans("transport-error", "http")[0] instanceof Error).toBe(true);
    });

    it("ssh, tcp and telnet use the production (output, error) shapes", () => {
        expect(ans("empty-success", "ssh")).toEqual(["", null]);
        expect(ans("transport-error", "ssh")[0]).toBeUndefined();
        expect(ans("timeout", "tcp")).toEqual([null, "Timeout"]);
        expect(ans("empty-success", "telnet")).toEqual(["", ""]);
    });

    it("snmp errors send a null (get) or object (walk) output", () => {
        expect(ans("transport-error", "snmpGet")[0]).toBeNull();
        expect(ans("transport-error", "snmpWalk")[0]).toEqual({});
    });

    it("tftp answers onReady(err, host, port)", () => {
        expect(ans("transport-error", "tftp")[0].message).toBeDefined();
        expect(ans("empty-success", "tftp")).toEqual([undefined, "192.0.2.10", 69]);
    });

    it("http-404 answers non-http kinds like transport-error", () => {
        expect(find("http-404").responder(KINDS.ssh.call)).toEqual(find("transport-error").responder(KINDS.ssh.call));
    });
});
