/**
 * SonicOS bearer token session check (BT-7109): every library driver that logs in through
 * POST /api/sonicos/auth, run against a simulated firewall in each state seen in the field.
 *
 * From SonicOS 7.3.4-7015 the firewall can require, on every API request after login, the bearer token
 * its /auth reply carries; a request with only the session cookie is refused with 401. A firewall with
 * the check off returns no token and wants the session cookie, as before.
 *
 * The simulated firewall answers the data requests of each driver's golden fixture (its session-cookie
 * case), so these specs follow the fixtures; see golden/sonicwall-bearer.js for the reply shapes.
 */
const path = require("path");
const { discoverDrivers } = require("./net/catalogue");
const { runEntryPoint } = require("./net/run-driver");
const { deterministicGlobals } = require("./golden/clock");
const reply = require("./golden/replies");
const { TOKEN, AUTH_WITH_TOKEN, TOKEN_INVALID, UNAUTHORIZED, BEARER, AUTH_PATH, cookieCase: findCookieCase } = require("./golden/sonicwall-bearer");

process.env.TZ = "UTC";

const EXAMPLES = path.join(__dirname, "..", "examples");
const FIXTURES = path.join(__dirname, "golden", "fixtures", "http");

const drivers = discoverDrivers(EXAMPLES).filter((d) => d.path.startsWith("http/sonicwall_") && d.source.includes(AUTH_PATH));

// The fixture case whose calls go through /auth with the session cookie (the firewall as it was before the check).
function cookieCase(driver) {
    return findCookieCase(require(path.join(FIXTURES, path.basename(driver.path))).cases);
}

/**
 * A firewall in one of four states:
 *   required      - returns a token and accepts only requests that carry it
 *   off           - returns no token and accepts only the session cookie, with no Bearer header
 *   refusesToken  - returns a token, refuses it, accepts the session cookie
 *   refusesAll    - returns a token and refuses every data request
 * forcedStatus, when given, is the status every data request gets instead (e.g. 403, 500).
 */
function firewall(calls, state, forcedStatus) {
    const requests = [];
    const baseReply = (call) => {
        const found = calls.find((c) => c.method === call.method && c.host === call.host
            && (c.target instanceof RegExp ? c.target.test(call.options.url) : c.target === call.options.url));
        return found && found.reply;
    };
    function responder(call) {
        const url = call.options && call.options.url;
        if (call.host || call.method === "post") {
            if (!call.host && url === AUTH_PATH && state !== "off") {
                return reply.http(200, AUTH_WITH_TOKEN);
            }
            return baseReply(call);
        }
        const authorization = call.options.headers && call.options.headers.Authorization;
        const bearer = authorization === BEARER.Authorization;
        const cookie = call.options.jar === true && !/^Bearer /.test(authorization || "");
        const sentWith = bearer ? "bearer" : (cookie ? "cookie" : "nothing");
        if (forcedStatus) {
            requests.push({ url, with: sentWith, jar: call.options.jar === true, status: forcedStatus });
            return reply.http(forcedStatus, UNAUTHORIZED);
        }
        const accepted = (state === "required" && bearer) || (state === "off" && cookie) || (state === "refusesToken" && cookie);
        requests.push({ url, with: sentWith, jar: call.options.jar === true, status: accepted ? 200 : 401 });
        if (accepted) {
            return baseReply(call);
        }
        return reply.http(401, state === "required" ? TOKEN_INVALID : UNAUTHORIZED);
    }
    return { responder, requests };
}

async function run(driver, entryPoint, state, forcedStatus) {
    const base = cookieCase(driver);
    const fw = firewall(base.entryPoints[entryPoint].calls, state, forcedStatus);
    const result = await runEntryPoint({
        source: driver.source,
        filename: driver.file,
        entryPoint,
        responder: fw.responder,
        parameters: base.parameters || {},
        driverType: driver.driverType,
        globals: deterministicGlobals(),
        timeLimitMs: 2000
    });
    return { result, requests: fw.requests };
}

describe("SonicOS bearer token session check", () => {
    it("covers every library driver that logs in through /auth", () => {
        expect(drivers.length).toBeGreaterThanOrEqual(9);
        drivers.forEach((d) => expect(cookieCase(d)).withContext(d.path).toBeDefined());
    });

    drivers.forEach((driver) => {
        describe(driver.path, () => {
            driver.entryPoints.forEach((entryPoint) => {
                it(entryPoint + " sends the token from /auth on every data request when the firewall returns one", async () => {
                    const { result, requests } = await run(driver, entryPoint, "required");
                    expect(result.firstReport && result.firstReport.type).toBe("success");
                    expect(requests.length).toBeGreaterThan(0);
                    expect(requests.filter((r) => r.status === 401)).withContext("requests refused by the firewall").toEqual([]);
                    expect(requests.every((r) => r.with === "bearer")).toBe(true);
                    expect(requests.filter((r) => r.jar)).withContext("token requests that also carry the session cookie").toEqual([]);
                });

                it(entryPoint + " keeps the session cookie request, with no Bearer header, when the firewall returns no token", async () => {
                    const { result, requests } = await run(driver, entryPoint, "off");
                    expect(result.firstReport && result.firstReport.type).toBe("success");
                    expect(requests.map((r) => r.with + " " + r.status)).toEqual(requests.map(() => "cookie 200"));
                });

                it(entryPoint + " retries a refused token once with the session cookie", async () => {
                    const { result, requests } = await run(driver, entryPoint, "refusesToken");
                    expect(result.firstReport && result.firstReport.type).toBe("success");
                    expect(requests.map((r) => r.with + " " + r.status)).toEqual(["bearer 401", "cookie 200"]);
                });

                it(entryPoint + " reports an authentication error, after one retry, when the firewall refuses token and cookie", async () => {
                    const { result, requests } = await run(driver, entryPoint, "refusesAll");
                    expect(result.firstReport && result.firstReport.type).toBe("failure");
                    expect(result.firstReport.errorType).toBe("AUTHENTICATION_ERROR");
                    expect(requests.map((r) => r.with + " " + r.status)).toEqual(["bearer 401", "cookie 401"]);
                });

                it(entryPoint + " never writes the token to the execution log", async () => {
                    for (const state of ["required", "refusesToken", "refusesAll"]) {
                        const { result } = await run(driver, entryPoint, state);
                        expect(JSON.stringify(result.logs)).withContext(state).not.toContain(TOKEN);
                    }
                });
            });
        });
    });

    // The backup driver is the only one whose export error mapping and 2FA (/tfa) login this change touches.
    describe("backup driver export errors", () => {
        const backup = drivers.find((d) => d.path === "http/sonicwall_firewall_backups_configuration.js");
        const tfaCase = require(path.join(FIXTURES, path.basename(backup.path))).cases.find((c) => c.name === "2FA bearer token");

        backup.entryPoints.forEach((entryPoint) => {
            it(entryPoint + " reports an authentication error, with no retry, when the export is forbidden (403)", async () => {
                const { result, requests } = await run(backup, entryPoint, "required", 403);
                expect(result.firstReport && result.firstReport.type).toBe("failure");
                expect(result.firstReport.errorType).toBe("AUTHENTICATION_ERROR");
                expect(requests.map((r) => r.with + " " + r.status)).toEqual(["bearer 403"]);
            });

            it(entryPoint + " reports an unavailable resource, with no retry, when the export fails with 500", async () => {
                const { result, requests } = await run(backup, entryPoint, "required", 500);
                expect(result.firstReport && result.firstReport.type).toBe("failure");
                expect(result.firstReport.errorType).toBe("RESOURCE_UNAVAILABLE");
                expect(requests.map((r) => r.with + " " + r.status)).toEqual(["bearer 500"]);
            });

            it(entryPoint + " logs the status code and the firewall's reply when the export is refused", async () => {
                const { result } = await run(backup, entryPoint, "refusesAll");
                const logs = JSON.stringify(result.logs);
                expect(logs).toContain("401");
                expect(logs).toContain(UNAUTHORIZED.status.info[0].message);
            });

            it(entryPoint + " does not retry with the session cookie a token from the 2FA login that the firewall refuses", async () => {
                const calls = tfaCase.entryPoints[entryPoint].calls;
                const requests = [];
                const result = await runEntryPoint({
                    source: backup.source,
                    filename: backup.file,
                    entryPoint,
                    responder: (call) => {
                        if (call.method === "post") {
                            const found = calls.find((c) => c.method === "post" && c.target === call.options.url);
                            return found && found.reply;
                        }
                        const authorization = (call.options.headers && call.options.headers.Authorization) || "";
                        requests.push(/^Bearer /.test(authorization) ? "bearer" : "no bearer");
                        return reply.http(401, TOKEN_INVALID);
                    },
                    parameters: tfaCase.parameters || {},
                    driverType: backup.driverType,
                    globals: deterministicGlobals(),
                    timeLimitMs: 2000
                });
                expect(requests).toEqual(["bearer"]);
                expect(result.firstReport && result.firstReport.type).toBe("failure");
                expect(result.firstReport.errorType).toBe("AUTHENTICATION_ERROR");
            });
        });
    });
});
