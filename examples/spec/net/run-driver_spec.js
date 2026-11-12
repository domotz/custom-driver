const fs = require("fs");
const path = require("path");
const { runEntryPoint, verdict } = require("./run-driver");
const { SCENARIOS } = require("./scenarios");

const FIXTURES = path.join(__dirname, "fixtures");
const scenario = (id) => SCENARIOS.find((s) => s.id === id).responder;

function run(fixture, scenarioId, extra) {
    const filename = path.join(FIXTURES, fixture);
    return runEntryPoint(Object.assign({
        source: fs.readFileSync(filename, "utf8"),
        filename,
        entryPoint: "validate",
        responder: scenario(scenarioId),
        parameters: {}
    }, extra));
}

describe("production-style runner", () => {
    it("passes a driver that reports from its HTTP callback", async () => {
        const result = await run("good.js", "empty-success");
        expect(verdict(result)).toEqual({ pass: true, reason: "" });
        expect(result.firstReport.type).toBe("success");
        expect(result.syncThrow).toBeNull();
        expect(result.wrapperError).toBeNull();
    });

    it("passes a throw inside a wrapped HTTP callback as GENERIC_ERROR", async () => {
        const result = await run("throws-in-http-callback.js", "transport-error");
        expect(verdict(result).pass).toBe(true);
        expect(result.firstReport.errorType).toBe("GENERIC_ERROR");
        expect(result.crashes).toEqual([]);
    });

    it("fails a throw inside an unwrapped WinRM callback as a crash", async () => {
        const result = await run("throws-in-winrm-callback.js", "transport-error");
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/crash.*sendWinRMCommand/);
    });

    it("fails an unhandled rejection with its reason", async () => {
        const result = await run("unhandled-rejection.js", "empty-success");
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/unhandled rejection: x/);
        expect(result.unhandledRejections.length).toBe(1);
    });

    it("attributes an unhandled rejection to its own case only", async () => {
        const first = await run("unhandled-rejection.js", "empty-success");
        const second = await run("good.js", "empty-success");
        expect(first.unhandledRejections.length).toBe(1);
        expect(verdict(first).pass).toBe(false);
        expect(second.unhandledRejections.length).toBe(0);
        expect(verdict(second).pass).toBe(true);
    });

    it("fails a driver that goes idle without reporting, without waiting out the limit", async () => {
        const started = Date.now();
        const result = await run("never-reports.js", "empty-success", { timeLimitMs: 2000 });
        const elapsed = Date.now() - started;
        expect(result.timedOut).toBe(true);
        expect(verdict(result).pass).toBe(false);
        expect(verdict(result).reason).toMatch(/never reported/);
        expect(elapsed).toBeLessThan(2000 + 500);
    });

    it("fails a driver still pending at the time limit without a report", async () => {
        const started = Date.now();
        const result = await run("never-reports-polling.js", "empty-success", { timeLimitMs: 300 });
        const elapsed = Date.now() - started;
        expect(result.timedOut).toBe(true);
        expect(verdict(result).pass).toBe(false);
        expect(verdict(result).reason).toMatch(/timed out/);
        expect(elapsed).toBeGreaterThanOrEqual(290);
        expect(elapsed).toBeLessThan(300 + 500);
    });

    it("passes a driver that reported and is still pending at the limit", async () => {
        const result = await run("reports-then-polls.js", "empty-success", { timeLimitMs: 300 });
        expect(result.timedOut).toBe(false);
        expect(verdict(result)).toEqual({ pass: true, reason: "" });
    });

    it("fails a timer that throws after the driver reported", async () => {
        const result = await run("crash-after-report.js", "empty-success");
        const v = verdict(result);
        expect(result.firstReport.type).toBe("success");
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/crash.*setTimeout.*late crash/);
    });

    it("fails an implicit global: the wrapper reports GENERIC_ERROR but the driver is broken under SES", async () => {
        const result = await run("strict-implicit-global.js", "empty-success");
        expect(result.syncThrow).toBeNull();
        expect(result.wrapperError).toEqual(jasmine.any(Error));
        expect(result.wrapperError.name).toBe("ReferenceError");
        expect(result.firstReport.errorType).toBe("GENERIC_ERROR");
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/broken under SES strict mode: .*x is not defined/);
    });

    it("fails a strict-mode SyntaxError thrown synchronously by evaluate", async () => {
        const result = await run("strict-octal-literal.js", "empty-success");
        expect(result.syncThrow).toEqual(jasmine.any(SyntaxError));
        expect(result.firstReport.errorType).toBe("GENERIC_ERROR");
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/^broken under SES strict mode: /);
    });

    it("passes a TypeError from bad input in the entry point's body as GENERIC_ERROR", async () => {
        const result = await run("bad-input-type-error.js", "empty-success");
        expect(result.wrapperError.name).toBe("TypeError");
        expect(result.firstReport.errorType).toBe("GENERIC_ERROR");
        expect(verdict(result)).toEqual({ pass: true, reason: "" });
    });

    it("delivers the scenario response to a transport call made at load time", async () => {
        const result = await run("top-level-transport.js", "http-404");
        expect(verdict(result).pass).toBe(true);
        expect(result.firstReport.type).toBe("success");
        expect(result.firstReport.variables[0].value).toBe("404");
    });

    it("stops a driver that re-requests on every reply and flags it as runaway", async () => {
        const result = await run("runaway-pagination.js", "empty-success");
        expect(result.runaway).toBe(true);
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/runaway/);
    });

    it("fails a socket that writes after end with no error listener", async () => {
        const result = await run("uses-net-socket.js", "garbage-success");
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/crash in net\.error.*write after end/);
    });

    it("fails a socket error with no error listener", async () => {
        const result = await run("uses-net-socket.js", "transport-error");
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/crash in net\.error.*ECONNREFUSED/);
    });

    it("passes a socket driver that handles errors and reports from its data", async () => {
        const refused = await run("uses-net-socket-handled.js", "transport-error");
        expect(verdict(refused)).toEqual({ pass: true, reason: "" });
        expect(refused.firstReport.errorType).toBe("RESOURCE_UNAVAILABLE");
        const garbage = await run("uses-net-socket-handled.js", "garbage-success");
        expect(verdict(garbage)).toEqual({ pass: true, reason: "" });
        expect(garbage.firstReport.variables[0].value).toBe("%%% unexpected output %%%");
    });

    it("fires the socket timeout event, never error, when a silent peer outlasts setTimeout", async () => {
        const result = await run("uses-net-socket-timeout.js", "timeout");
        expect(verdict(result)).toEqual({ pass: true, reason: "" });
        expect(result.firstReport.errorType).toBe("TIMEOUT_ERROR");
        expect(result.crashes.length).toBe(0);
    });

    it("keeps a silent socket with no inactivity timer open: no error, and the driver never reports", async () => {
        const handled = await run("uses-net-socket-handled.js", "timeout");
        expect(handled.firstReport).toBeFalsy();
        expect(handled.crashes.length).toBe(0);
        expect(verdict(handled).reason).toMatch(/never reported|timed out/);
        const unhandled = await run("uses-net-socket.js", "timeout");
        expect(unhandled.crashes.length).toBe(0);
        expect(verdict(unhandled).reason).toMatch(/never reported|timed out/);
    });

    it("fails a driver that reads a D member the fake lacks", async () => {
        const result = await runEntryPoint({
            source: "function validate() { D.device.nope(); }",
            filename: "inline.js",
            entryPoint: "validate",
            responder: scenario("empty-success")
        });
        expect(verdict(result).pass).toBe(false);
        expect(verdict(result).reason).toMatch(/unknown sandbox member D\.device\.nope/);
    });

    it("fails a driver that calls require(), although production reports REQUIRE_NOT_ALLOWED", async () => {
        const result = await run("uses-require.js", "empty-success");
        expect(result.firstReport.errorType).toBe("REQUIRE_NOT_ALLOWED");
        expect(verdict(result)).toEqual({ pass: false, reason: "uses require/import, not allowed in the sandbox (require)" });
    });

    it("fails a driver that uses a dynamic import()", async () => {
        const result = await runEntryPoint({
            source: "function validate() { import(\"fs\").then(D.success); }",
            filename: "inline.js",
            entryPoint: "validate",
            responder: scenario("empty-success")
        });
        expect(result.syncThrow).toEqual(jasmine.any(SyntaxError));
        expect(verdict(result).reason).toMatch(/^uses require\/import, not allowed in the sandbox/);
    });

    it("passes a runtime SyntaxError from bad input (load-time JSON.parse) as GENERIC_ERROR", async () => {
        const result = await run("load-time-json-parse.js", "empty-success");
        expect(result.syncThrow).toBeNull();
        expect(result.wrapperError.name).toBe("SyntaxError");
        expect(result.firstReport.errorType).toBe("GENERIC_ERROR");
        expect(verdict(result)).toEqual({ pass: true, reason: "" });
    });

    it("fails a ReferenceError (implicit global) inside a wrapped HTTP callback", async () => {
        const result = await run("reference-error-in-http-callback.js", "transport-error");
        expect(result.crashes).toEqual([]);
        expect(result.firstReport.errorType).toBe("GENERIC_ERROR");
        const v = verdict(result);
        expect(v.pass).toBe(false);
        expect(v.reason).toMatch(/^broken under SES strict mode: ReferenceError: lastError is not defined/);
    });

    it("passes a driver that reports and then keeps polling over HTTP on a timer", async () => {
        const result = await run("reports-then-polls-transport.js", "empty-success");
        expect(result.runaway).toBe(false);
        expect(result.timedOut).toBe(false);
        expect(result.transportCalls).toBeGreaterThan(1);
        expect(verdict(result)).toEqual({ pass: true, reason: "" });
    });

    it("does not count transport calls after the first report as runaway", async () => {
        const result = await runEntryPoint({
            source: "function more() { D.device.http.get({}, more); }\nfunction validate() { D.success(); more(); }",
            filename: "inline.js",
            entryPoint: "validate",
            responder: scenario("empty-success"),
            timeLimitMs: 300
        });
        expect(result.transportCalls).toBeGreaterThan(200);
        expect(result.runaway).toBe(false);
        expect(verdict(result)).toEqual({ pass: true, reason: "" });
    });
});
