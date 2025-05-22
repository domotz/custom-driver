/**
 * Name: SonicWall CLI Configuration Backup (Hybrid 2FA Support)
 * Description: Retrieves CLI-style configuration from SonicWall firewalls. Supports both TOTP-based 2FA (Bearer Token) and traditional Basic Auth.
 *
 * Requirements:
 * - SonicOS 7.x with API enabled
 * - TOTP seed (Base32) if 2FA is enabled
 * - RFC-2617 Basic Authentication enabled
 *
 * Notes:
 * - If 2FA fails, script falls back to legacy /auth flow using session cookies
 * - Domotz marks all params as required, so for no-2FA use, enter a space in TOTP seed
 */

/**
 * @param {number} customPort
 * @label Custom Port
 * @description HTTPS port to communicate with SonicWall API (e.g. 8443)
 * @type NUMBER
 */
var customPort = D.getParameter("customPort");

/**
 * @param {string} totpSeed
 * @label TOTP Seed (Base32)
 * @description Base32-encoded TOTP seed for 2FA logins. If unused, enter a space.
 * @type SECRET_TEXT
 */
var totpSeed = D.getParameter("totpSeed");

var cliExportPath = "/api/sonicos/export/current-config/cli";
var tfaPath = "/api/sonicos/tfa";
var authPath = "/api/sonicos/auth";

function toBase64(str) {
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "", i = 0;
    while (i < str.length) {
        var c1 = str.charCodeAt(i++), c2 = str.charCodeAt(i++), c3 = str.charCodeAt(i++);
        var e1 = c1 >> 2;
        var e2 = ((c1 & 3) << 4) | (c2 >> 4);
        var e3 = ((c2 & 15) << 2) | (c3 >> 6);
        var e4 = c3 & 63;
        if (isNaN(c2)) e3 = e4 = 64;
        else if (isNaN(c3)) e4 = 64;
        output += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4);
    }
    return output;
}

function decodeBase32(secret) {
    var base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    var cleaned = secret.replace(/=+$/, "").toUpperCase().replace(/[^A-Z2-7]/g, "");
    var bits = "", bytes = [], i;
    for (i = 0; i < cleaned.length; i++) {
        var val = base32chars.indexOf(cleaned.charAt(i));
        if (val !== -1) bits += ("00000" + val.toString(2)).slice(-5);
    }
    for (i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }
    return D._unsafe.buffer.from(bytes);
}

function generateTotpCode(secret) {
    var key = decodeBase32(secret);
    var time = Math.floor(new Date().getTime() / 1000 / 30);
    var msg = D._unsafe.buffer.alloc(8, 0);
    for (var i = 7; i >= 0; i--) {
        msg[i] = time & 0xff;
        time >>= 8;
    }
    var hash = D.crypto.hmac(msg, key, "sha1");
    var offset = hash[hash.length - 1] & 0x0f;
    var code = ((hash[offset] & 0x7f) << 24) |
               ((hash[offset + 1] & 0xff) << 16) |
               ((hash[offset + 2] & 0xff) << 8) |
               (hash[offset + 3] & 0xff);
    return (code % 1000000).toString().padStart(6, "0");
}

function attemptTfaLogin() {
    var d = D.q.defer();
    var username = D.device.username();
    var password = D.device.password();
    var totp = generateTotpCode(totpSeed);

    var tfaPayload = {
        url: tfaPath,
        port: customPort,
        protocol: "https",
        rejectUnauthorized: false,
        timeout: 15000,
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({
            user: username,
            password: password,
            tfa: totp,
            override: true
        })
    };

    console.log("Attempting login via /tfa...");
    D.device.http.post(tfaPayload, function (err, res, body) {
        if (!err && res && res.statusCode === 200) {
            try {
                var parsed = JSON.parse(body);
                var token = parsed.status && parsed.status.info && parsed.status.info[0].bearer_token;
                if (token) {
                    console.log("Bearer token acquired.");
                    d.resolve({ type: "bearer", value: token });
                    return;
                }
            } catch (e) {
                console.warn("TFA response parse failed.");
            }
        }
        d.reject("TFA failed");
    });

    return d.promise;
}

function fallbackToLegacyAuth() {
    var d = D.q.defer();
    var authOptions = {
        url: authPath,
        protocol: "https",
        port: customPort,
        rejectUnauthorized: false,
        timeout: 15000,
        jar: true,
        auth: "basic",
        username: D.device.username(),
        password: D.device.password(),
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
        },
        body: JSON.stringify({ override: true })
    };

    console.log("Attempting fallback login via /auth...");
    D.device.http.post(authOptions, function (err, res) {
        if (!err && res && res.statusCode === 200) {
            console.log("Fallback login succeeded.");
            d.resolve({ type: "cookie", jar: true });
        } else {
            console.error("Fallback login failed.");
            d.reject(D.errorType.AUTHENTICATION_ERROR);
        }
    });

    return d.promise;
}

function loginAndGetToken() {
    return attemptTfaLogin().catch(function () {
        return fallbackToLegacyAuth();
    });
}

function getCliConfig(authMode) {
    var d = D.q.defer();

    var request = {
        url: cliExportPath,
        protocol: "https",
        port: customPort,
        rejectUnauthorized: false,
        timeout: 20000,
        headers: {
            "Accept": "application/json"
        },
        encoding: null
    };

    if (authMode.type === "bearer") {
        request.headers.Authorization = "Bearer " + authMode.value;
    } else {
        request.jar = true;
        request.auth = {
            user: D.device.username(),
            pass: D.device.password(),
            sendImmediately: true
        };
    }

    console.log("Fetching CLI config...");
    D.device.http.get(request, function (err, res, body) {
        if (err || !res || res.statusCode !== 200) {
            console.error("Fetch failed: " + (err || res.statusCode));
            d.reject(D.errorType.RESOURCE_UNAVAILABLE);
            return;
        }

        try {
            var bodyText = body.toString("utf8");
            var clean = JSON.stringify(JSON.parse(bodyText), null, 2);
            d.resolve(clean);
        } catch (e) {
            console.error("JSON parse failed: " + e);
            d.reject(D.errorType.GENERIC_ERROR);
        }
    });

    return d.promise;
}

/**
 * @remote_procedure
 * @label Validate SonicWall Login (with 2FA fallback)
 * @documentation Confirms login using either bearer token or basic + auth fallback
 */
function validate() {
    loginAndGetToken()
        .then(getCliConfig)
        .then(function () {
            D.success();
        })
        .catch(function (err) {
            D.failure(err || D.errorType.AUTHENTICATION_ERROR, "CLI config fetch failed");
        });
}

/**
 * @remote_procedure
 * @label Backup SonicWall CLI Configuration (Hybrid Auth)
 * @documentation Retrieves CLI config using bearer token or fallback to /auth
 */
function backup() {
    loginAndGetToken()
        .then(getCliConfig)
        .then(function (configJson) {
            D.success(D.createBackup({
                label: "SonicWall CLI Configuration (Hybrid)",
                running: configJson,
                ignoredLines: [
                    "^\\s*\"system_time\"\\s*:\\s*\".*\",?",
                    "^\\s*\"system_uptime\"\\s*:\\s*\".*\",?",
                    "^\\s*\"password\"\\s*:\\s*\"6,.*\",?",
                    "^\\s*\"confirm_secret\"\\s*:\\s*\"6,.*\",?",
                    "^\\s*\"shared_secret\"\\s*:\\s*\"6,.*\",?",
                    "^\\s*\"secret\"\\s*:\\s*\"6,.*\",?",
                    "^\\s*\"user_password\"\\s*:\\s*\"6,.*\",?",
                    "^\\s*\"passphrase\"\\s*:\\s*\"6,.*\",?"
                ]
            }));
        })
        .catch(function (err) {
            D.failure(err || D.errorType.GENERIC_ERROR, "Backup failed");
        });
}
