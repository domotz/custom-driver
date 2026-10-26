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
    tftp: { arity: 2, call: { kind: "tftp", method: "accept", options: {} } }
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

    it("http-404 answers non-http kinds like transport-error", () => {
        expect(find("http-404").responder(KINDS.ssh.call)).toEqual(find("transport-error").responder(KINDS.ssh.call));
    });
});
