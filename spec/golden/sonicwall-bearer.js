/**
 * SonicOS bearer token session check (BT-7109).
 *
 * From SonicOS 7.3.4-7015 "Non-GUI Management Login Bearer Token Session Check" is on by default: the
 * POST /api/sonicos/auth reply then carries status.info[].bearer_token and every later API request must
 * send it as "Authorization: Bearer <token>"; a request with only the session cookie is refused with 401
 * E_UNAUTHORIZED "Unauthorized. Bearer token is invalid." (firewall replies as captured by Support in
 * BT-7109 / ZD-91187). A firewall with the check off returns no token and accepts the session cookie.
 *
 * bearerCases(cases) derives two cases from a fixture's session-cookie case (the one that calls /auth):
 *   - "bearer token required": /auth returns a token and each SonicOS data request must carry it;
 *   - "bearer token refused": /auth returns a token, the firewall answers 401 to the request that
 *     carries it, and the driver must retry once the way it did before (no Bearer header).
 * Calls to other hosts (e.g. raw.githubusercontent.com) and the /tfa attempt are left as they are.
 */
const reply = require("./replies");

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.sonicos-api-session";
const AUTH_WITH_TOKEN = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success.", bearer_token: TOKEN }] } };
const TOKEN_INVALID = { status: { success: false, info: [{ level: "error", code: "E_UNAUTHORIZED", message: "Unauthorized. Bearer token is invalid." }] } };
const UNAUTHORIZED = { status: { success: false, info: [{ level: "error", code: "E_UNAUTHORIZED", message: "Unauthorized." }] } };
const BEARER = { Authorization: "Bearer " + TOKEN };
const NO_BEARER = { Authorization: undefined };

const AUTH_PATH = "/api/sonicos/auth";
const isLogin = (call) => call.method === "post" && call.target === AUTH_PATH;
const isData = (call) => call.method === "get" && !call.host && String(call.target).startsWith("/api/sonicos/");

function tokenRequired(calls) {
    return calls.map((call) => {
        if (isLogin(call)) {
            return Object.assign({}, call, { reply: reply.http(200, AUTH_WITH_TOKEN) });
        }
        return isData(call) ? Object.assign({}, call, { headers: BEARER }) : call;
    });
}

function tokenRefused(calls) {
    return calls.flatMap((call) => {
        if (isLogin(call)) {
            return [Object.assign({}, call, { reply: reply.http(200, AUTH_WITH_TOKEN) })];
        }
        if (isData(call)) {
            return [
                Object.assign({}, call, { headers: BEARER, reply: reply.http(401, UNAUTHORIZED) }),
                Object.assign({}, call, { headers: NO_BEARER })
            ];
        }
        return [call];
    });
}

function derive(baseCase, suffix, transform) {
    const entryPoints = {};
    Object.keys(baseCase.entryPoints).forEach((name) => {
        entryPoints[name] = Object.assign({}, baseCase.entryPoints[name], { calls: transform(baseCase.entryPoints[name].calls) });
    });
    return Object.assign({}, baseCase, { name: baseCase.name + ", " + suffix, entryPoints });
}

// The fixture case that logs in through /auth with the session cookie (not, e.g., the 2FA /tfa flow).
function cookieCase(cases) {
    return cases.find((c) => !/bearer token/.test(c.name)
        && Object.keys(c.entryPoints).every((name) => c.entryPoints[name].calls.some(isLogin)));
}

function bearerCases(cases) {
    const baseCase = cookieCase(cases);
    if (!baseCase) {
        throw new Error("no fixture case logs in through " + AUTH_PATH);
    }
    return [
        derive(baseCase, "bearer token required", tokenRequired),
        derive(baseCase, "bearer token refused", tokenRefused)
    ];
}

module.exports = { bearerCases, cookieCase, AUTH_PATH, TOKEN, AUTH_WITH_TOKEN, TOKEN_INVALID, UNAUTHORIZED, BEARER, NO_BEARER };
