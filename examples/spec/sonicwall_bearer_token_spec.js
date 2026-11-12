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
const { TOKEN, AUTH_WITH_TOKEN, TOKEN_INVALID, UNAUTHORIZED, BEARER } = require("./golden/sonicwall-bearer");

process.env.TZ = "UTC";

const EXAMPLES = path.join(__dirname, "..");
const FIXTURES = path.join(__dirname, "golden", "fixtures", "http");
const AUTH_PATH = "/api/sonicos/auth";

const drivers = discoverDrivers(EXAMPLES).filter((d) => d.path.startsWith("http/sonicwall_") && d.source.includes(AUTH_PATH));

// The fixture case whose calls go through /auth with the session cookie (the firewall as it was before the check).
function cookieCase(driver) {
    const fixture = require(path.join(FIXTURES, path.basename(driver.path)));
    return fixture.cases.find((c) => !/bearer token/.test(c.name)
        && Object.values(c.entryPoints)[0].calls.some((call) => call.target === AUTH_PATH));
}

/**
 * A firewall in one of four states:
 *   required      - returns a token and accepts only requests that carry it
 *   off           - returns no token and accepts only the session cookie, with no Bearer header
 *   refusesToken  - returns a token, refuses it, accepts the session cookie
 *   refusesAll    - returns a token and refuses every data request
 */
function firewall(calls, state) {
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
        const accepted = (state === "required" && bearer) || (state === "off" && cookie) || (state === "refusesToken" && cookie);
        requests.push({ url, with: bearer ? "bearer" : (cookie ? "cookie" : "nothing"), status: accepted ? 200 : 401 });
        if (accepted) {
            return baseReply(call);
        }
        return reply.http(401, state === "required" ? TOKEN_INVALID : UNAUTHORIZED);
    }
    return { responder, requests };
}

async function run(driver, entryPoint, state) {
    const base = cookieCase(driver);
    const fw = firewall(base.entryPoints[entryPoint].calls, state);
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
    it("covers the nine library drivers that log in through /auth", () => {
        expect(drivers.length).toBe(9);
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
});
