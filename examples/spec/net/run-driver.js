/**
 * Production-style runner for the driver robustness net.
 *
 * Runs one entry point of one driver the way the collector sandbox does
 * (remote_pawn_ng src/sandbox/sandbox.js): a fresh SES Compartment (no lockdown(), like the
 * remote_pawn_ng unit specs) with the same endowments, the driver source inside the same async
 * wrapper. Transports answer from a scenario responder (scenarios.js) through the strict fake D
 * (fake-d.js); timers and sockets are tracked fakes (sandbox-io.js).
 *
 * runEntryPoint({ source, filename, entryPoint, responder, parameters, timeLimitMs }) -> Promise<CaseResult>
 * CaseResult = { firstReport, reports, crashes, unhandledRejections, syncThrow, wrapperError,
 *                timedOut, idle, runaway, unknownMembers, transportCalls, logs, elapsedMs }
 * verdict(result) -> { pass, reason }
 */

require("ses");
// ses installs Compartment (and lockdown/harden) on globalThis; lockdown() is never called.
const { Compartment } = globalThis;
const { createFakeD } = require("./fake-d");
const { createNet, createDgram, createSetTimeout } = require("./sandbox-io");

const RUNAWAY_TRANSPORT_CALLS = 200;
const WRAPPER_ERROR_PREFIX = "Uncaught error during script execution: ";
const WRAPPER_NON_ERROR = "Generic error during script execution";

// sandbox.js wrapper, verbatim except that errorTypes.GENERIC_ERROR is the literal value.
function wrapScript(source, entryPoint) {
    return `async function __fnDomotzWrap() { ${source}\n${entryPoint}(); };
    __fnDomotzWrap()
    .catch((err) => {
        if (err instanceof Error) {
            console.error('Uncaught error during script execution: ' + err.message);
            console.error(err.stack);
        } else {
            console.error("Generic error during script execution");
            console.error(JSON.stringify(err, null, 2));
        }
        D.failure('GENERIC_ERROR');
    });`;
}

// The sandbox console (library/logger.js) has exactly these members. The wrapper's .catch only
// logs what it caught, so the error it caught is rebuilt from its two console.error calls.
function createConsole(logs, onWrapperError) {
    let wrapperPending = null;
    const write = (level) => (...args) => {
        logs.push({ level, args });
        if (level !== "error") {
            return;
        }
        if (wrapperPending !== null) {
            onWrapperError(wrapperPending, args[0]);
            wrapperPending = null;
        } else if (typeof args[0] === "string" && args[0].startsWith(WRAPPER_ERROR_PREFIX)) {
            wrapperPending = { message: args[0].slice(WRAPPER_ERROR_PREFIX.length) };
        } else if (args[0] === WRAPPER_NON_ERROR) {
            wrapperPending = { nonError: true };
        }
    };
    const sandboxConsole = {
        debug: write("debug"),
        info: write("info"),
        warn: write("warn"),
        error: write("error"),
        get: () => logs.map((entry) => entry.args.join(" ")),
        decorate: () => sandboxConsole
    };
    sandboxConsole.log = sandboxConsole.debug;
    sandboxConsole.verbose = sandboxConsole.debug;
    sandboxConsole.warning = sandboxConsole.warn;
    return sandboxConsole;
}

function rebuildWrapperError(pending, detail) {
    if (pending.nonError) {
        const error = new Error("non-Error rejection: " + detail);
        error.name = "NonErrorRejection";
        return error;
    }
    const error = new Error(pending.message);
    const stack = typeof detail === "string" ? detail : "";
    const name = /^([A-Za-z_$][\w$]*)(?::|$)/.exec(stack);
    error.name = name ? name[1] : "Error";
    error.stack = stack;
    return error;
}

/*
 * Attributing unhandled rejections to the case that caused them.
 *
 * jasmine 5 (jasmine-core GlobalErrors / NodeAdapter) replaces every process
 * "uncaughtException"/"unhandledRejection" listener with its own while specs run, and routes
 * each event to the top of its handler stack, which fails the current spec. Its public, scoped
 * escape hatch is jasmine.spyOnGlobalErrorsAsync(fn): for the duration of fn it installs an
 * override listener (GlobalErrors#setOverrideListener) that receives every global error instead
 * of the spec failing, and removes it afterwards. The runner wraps exactly one case in it and
 * records the events itself through its own process listeners (added after jasmine's, so both
 * fire), which are removed when the case ends. jasmine's handling is untouched outside the case.
 * detectLateRejectionHandling (off by default) would defer rejections past the override, so the
 * runner refuses to run with it on rather than misattribute.
 * Cases run serially; a case ends only after it is idle plus one extra setImmediate turn, and
 * Node emits "unhandledRejection" at the end of the macrotask that created the rejection, so a
 * rejection is always seen by the case that caused it (attribution spec in run-driver_spec.js).
 */
async function scopeGlobalErrors(fn) {
    const j = globalThis.jasmine;
    if (!j || typeof j.spyOnGlobalErrorsAsync !== "function") {
        return fn();
    }
    if (j.getEnv().configuration().detectLateRejectionHandling) {
        throw new Error("run-driver: jasmine detectLateRejectionHandling must be off for exact attribution");
    }
    let result;
    await j.spyOnGlobalErrorsAsync(async () => {
        result = await fn();
    });
    return result;
}

function runCase(options) {
    const { source, entryPoint, responder, parameters, timeLimitMs } = options;
    const started = Date.now();
    const logs = [];
    const unhandledRejections = [];
    const realTimers = new Set();
    let pending = 0;
    let activity = 0;
    let closed = false;
    let runaway = false;
    let wrapperError = null;
    let syncThrow = null;
    let record = null;
    let finish;
    const done = new Promise((resolve) => {
        finish = resolve;
    });

    const runTracked = (fn, where) => {
        activity++;
        try {
            fn();
        } catch (error) {
            record.crashes.push({ where, error });
        }
        checkIdle();
    };

    // Every transport callback, timer and socket event goes through here.
    const deliver = (fn, where) => {
        if (closed) {
            return;
        }
        if (record && record.transportCalls > RUNAWAY_TRANSPORT_CALLS) {
            runaway = true;
            return;
        }
        pending++;
        setImmediate(() => {
            pending--;
            if (!closed) {
                runTracked(fn, where || "callback");
            }
        });
    };
    const timer = (fn, ms) => {
        if (closed) {
            return;
        }
        pending++;
        const handle = setTimeout(() => {
            realTimers.delete(handle);
            pending--;
            if (!closed) {
                runTracked(fn, "setTimeout");
            }
        }, ms);
        realTimers.add(handle);
    };

    // Idle = nothing pending for one full setImmediate turn after the last delivery ran.
    function checkIdle() {
        if (pending !== 0 || closed) {
            return;
        }
        const seen = activity;
        setImmediate(() => {
            if (!closed && pending === 0 && activity === seen) {
                end("idle");
            }
        });
    }

    const onRejection = (reason) => unhandledRejections.push(reason);
    const onException = (error) => record.crashes.push({ where: "uncaughtException", error });
    let limitTimer = null;

    function end(how) {
        closed = true;
        clearTimeout(limitTimer);
        realTimers.forEach(clearTimeout);
        realTimers.clear();
        // One extra turn so a rejection from the last delivery is emitted before collecting.
        setImmediate(() => {
            process.removeListener("unhandledRejection", onRejection);
            process.removeListener("uncaughtException", onException);
            const firstReport = record.firstReport;
            finish({
                firstReport,
                reports: record.reports,
                crashes: record.crashes,
                unhandledRejections,
                syncThrow,
                wrapperError,
                timedOut: !firstReport && !syncThrow && !runaway && (how === "limit" || how === "idle"),
                idle: how === "idle",
                runaway,
                unknownMembers: record.unknownMembers,
                transportCalls: record.transportCalls,
                logs,
                elapsedMs: Date.now() - started
            });
        });
    }

    const fake = createFakeD({ responder, parameters, schedule: (fn) => deliver(fn, "callback") });
    record = fake.record;
    const D = fake.D;
    const ctx = { responder, record, deliver, timer };
    const sandboxConsole = createConsole(logs, (pending_, detail) => {
        wrapperError = rebuildWrapperError(pending_, detail);
    });

    const endowments = {
        D,
        import: function () {
            sandboxConsole.error("Error: Import not possible in sandbox");
            D.failure("IMPORT_NOT_ALLOWED");
        },
        require: function () {
            sandboxConsole.error("Error: Require not possible in sandbox");
            D.failure("REQUIRE_NOT_ALLOWED");
        },
        console: sandboxConsole,
        setTimeout: createSetTimeout(ctx),
        net: createNet(ctx),
        dgram: createDgram(ctx),
        Date,
        Math,
        Intl
    };

    process.on("unhandledRejection", onRejection);
    process.on("uncaughtException", onException);
    limitTimer = setTimeout(() => end("limit"), timeLimitMs);

    try {
        const compartment = new Compartment({ globals: endowments, __options__: true });
        compartment.evaluate(wrapScript(source, entryPoint));
    } catch (error) {
        // sandbox.js: a synchronous throw from evaluate (SyntaxError) is reported as GENERIC_ERROR.
        syncThrow = error;
        sandboxConsole.error("Caught exception: " + String(error) + "\n" + error.stack);
        D.failure("GENERIC_ERROR");
    }
    // The wrapper's own promise jobs run before this turn ends; start idle detection after them.
    setImmediate(checkIdle);
    return done;
}

function runEntryPoint(options) {
    const opts = Object.assign({ parameters: {}, timeLimitMs: 2000 }, options);
    return scopeGlobalErrors(() => runCase(opts));
}

function describeError(error) {
    if (error instanceof Error) {
        return error.name + ": " + error.message + (error.stack ? "\n" + error.stack : "");
    }
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function describeReason(reason) {
    if (reason instanceof Error) {
        return reason.message + (reason.stack ? "\n" + reason.stack : "");
    }
    return describeError(reason);
}

// ReferenceError / SyntaxError caught by the wrapper or thrown by evaluate: production reports
// GENERIC_ERROR, but these are code bugs that break the driver on EVERY run under SES strict mode
// (e.g. a regression to an implicit global on 9.x collectors), whatever the device answers, so
// they fail. Other errors from the entry point's sync body (e.g. a TypeError on bad input) are
// production-acceptable GENERIC_ERROR reports and pass (controller ruling, Task 3).
const STRICT_MODE_BREAKERS = new Set(["ReferenceError", "SyntaxError"]);

function verdict(result) {
    const problems = [];
    result.crashes.forEach((c) => problems.push("crash in " + c.where + ": " + describeReason(c.error)));
    result.unhandledRejections.forEach((r) => problems.push("unhandled rejection: " + describeReason(r)));
    result.unknownMembers.forEach((m) => problems.push("unknown sandbox member " + m));
    [result.syncThrow, result.wrapperError].forEach((e) => {
        if (e && STRICT_MODE_BREAKERS.has(e.name)) {
            problems.push("broken under SES strict mode: " + describeError(e));
        }
    });
    if (result.runaway) {
        problems.push("runaway: more than " + RUNAWAY_TRANSPORT_CALLS + " transport calls in one case");
    }
    if (result.timedOut) {
        problems.push(result.idle
            ? "never reported: went idle with nothing pending (production runs into the script timeout)"
            : "timed out after " + result.elapsedMs + " ms without reporting");
    } else if (!result.firstReport && !result.syncThrow && problems.length === 0) {
        problems.push("never reported");
    }
    return problems.length ? { pass: false, reason: problems[0] } : { pass: true, reason: "" };
}

module.exports = { runEntryPoint, verdict, RUNAWAY_TRANSPORT_CALLS };
