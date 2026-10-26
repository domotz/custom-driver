/**
 * Strict fake of the Domotz sandbox global `D` for the driver robustness net.
 *
 * Mirrors remote_pawn_ng/src/sandbox (context.js, library/*). Reads of members
 * that production does not have throw, so a driver relying on a missing API
 * fails loudly instead of silently getting `undefined`.
 *
 * createFakeD({ responder, parameters, schedule, device }) -> { D, record }
 *   responder(call) -> positional callback args array (or undefined to never call back)
 *   call = { kind, method, options[, host][, sessionOptions] }
 *   schedule(fn) delivers callbacks (default setImmediate)
 */

const nodeCrypto = require("crypto");
const cheerio = require("cheerio");
const lodash = require("lodash");

// Key sets copied from remote_pawn_ng/src/sandbox/constants.js
const errorType = {
    MISSING_DEVICE_ERROR: "MISSING_DEVICE_ERROR",
    RESOURCE_UNAVAILABLE: "RESOURCE_UNAVAILABLE",
    AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
    PARSING_ERROR: "PARSING_ERROR",
    TIMEOUT_ERROR: "TIMEOUT_ERROR",
    IMPORT_NOT_ALLOWED: "IMPORT_NOT_ALLOWED",
    REQUIRE_NOT_ALLOWED: "REQUIRE_NOT_ALLOWED",
    GENERIC_ERROR: "GENERIC_ERROR",
    METRIC_VALIDATION_ERROR: "METRIC_VALIDATION_ERROR",
    TABLE_VALIDATION_ERROR: "TABLE_VALIDATION_ERROR"
};
const valueType = {
    STRING: "STRING",
    NUMBER: "NUMBER",
    DATETIME: "DATETIME",
    RATE: "RATE",
    MONOTONE_RATE: "MONOTONE_RATE"
};
const deviceProperty = { SERIAL: "SERIAL", FIRMWARE: "FIRMWARE", MODEL: "MODEL" };

// Methods whose callbacks production wraps in try/catch (7.4.4+).
const WRAPPED = new Set([
    "http.get", "http.post", "http.put", "http.delete",
    "sendSSHCommand", "sendTelnetCommand", "sendTCPCommand",
    "snmp.get", "snmp.walk", "snmp.getRaw", "snmp.set"
]);

// Reads made by Promise resolution, JSON.stringify, util.inspect and jasmine printing.
const PASSTHROUGH = new Set(["then", "toJSON", "inspect", "asymmetricMatch", "jasmineToString", "nodeType", "constructor", "and", "calls"]);

function strict(target, path, record) {
    return new Proxy(target, {
        get(obj, prop, receiver) {
            if (typeof prop === "symbol" || PASSTHROUGH.has(prop) || prop in obj) {
                return Reflect.get(obj, prop, receiver);
            }
            const name = path + "." + prop;
            record.unknownMembers.push(name);
            throw new Error("fake D has no member " + name);
        }
    });
}

function createFakeD(config) {
    const responder = config.responder;
    const parameters = config.parameters || {};
    const schedule = config.schedule || ((fn) => setImmediate(fn));
    const deviceInfo = Object.assign(
        { ip: "192.0.2.10", username: "user", password: "pass", serial: "SN0001", macAddress: "00:00:5E:00:53:01" },
        config.device
    );

    const record = {
        reports: [],
        crashes: [],
        wrappedThrows: [],
        transportCalls: 0,
        unknownMembers: [],
        get firstReport() {
            return record.reports[0];
        }
    };

    function report(type, errorTypeArg, variables, table) {
        const entry = { type, errorType: undefined, originalErrorType: undefined, variables, table };
        if (type === "failure") {
            entry.originalErrorType = errorTypeArg;
            entry.errorType = Object.prototype.hasOwnProperty.call(errorType, errorTypeArg) ? errorTypeArg : "GENERIC_ERROR";
        }
        record.reports.push(entry);
    }

    // Single delivery path: every callback goes through schedule().
    function transport(kind, method, wrapKey, host, extra) {
        return function (options, ...rest) {
            record.transportCalls++;
            const call = { kind, method, options };
            if (host !== undefined) {
                call.host = host;
            }
            Object.assign(call, extra);
            const callback = rest.find((arg) => typeof arg === "function");
            const args = responder(call);
            if (!callback || !Array.isArray(args)) {
                return;
            }
            const where = wrapKey.replace(/^snmp\./, "");
            schedule(() => {
                try {
                    callback(...args);
                } catch (error) {
                    if (WRAPPED.has(wrapKey)) {
                        record.wrappedThrows.push({ method: where, error });
                        report("failure", "GENERIC_ERROR");
                    } else {
                        record.crashes.push({ where, error });
                    }
                }
            });
        };
    }

    function deviceSurface(host) {
        const t = (kind, method, wrapKey, extra) => transport(kind, method, wrapKey || method, host, extra);
        const device = {
            http: strict(
                {
                    get: t("http", "get", "http.get"),
                    post: t("http", "post", "http.post"),
                    put: t("http", "put", "http.put"),
                    delete: t("http", "delete", "http.delete"),
                    getTLSCertificate: t("tls", "getTLSCertificate", "getTLSCertificate")
                },
                "D.device.http",
                record
            ),
            sendSSHCommand: t("ssh", "sendSSHCommand"),
            sendSSHCommands: t("sshCommands", "sendSSHCommands"),
            sendTelnetCommand: t("telnet", "sendTelnetCommand"),
            sendTCPCommand: t("tcp", "sendTCPCommand"),
            sendWinRMCommand: t("winrm", "sendWinRMCommand"),
            ping: t("ping", "ping"),
            mtr: t("mtr", "mtr"),
            createSNMPSession(sessionOptions) {
                const s = (method) => transport("snmp", method, "snmp." + method, host, { sessionOptions });
                return strict(
                    { get: s("get"), walk: s("walk"), getRaw: s("getRaw"), set: s("set") },
                    "D.device.snmpSession",
                    record
                );
            },
            ip: () => host || deviceInfo.ip,
            serial: () => deviceInfo.serial,
            macAddress: () => deviceInfo.macAddress,
            username: () => deviceInfo.username,
            password: () => deviceInfo.password,
            createVariable: (uid, name, value, unit, vt) => ({ uid, name, value, unit, valueType: vt })
        };
        return device;
    }

    const crypto = strict(
        {
            hash(data, algorithm, inputEncoding, outputEncoding) {
                const h = nodeCrypto.createHash(algorithm);
                h.update(data, inputEncoding);
                return h.digest(outputEncoding);
            },
            hmac(data, key, algorithm, outputEncoding) {
                const h = nodeCrypto.createHmac(algorithm, key);
                h.update(data);
                return h.digest(outputEncoding);
            }
        },
        "D.crypto",
        record
    );

    const device = strict(deviceSurface(undefined), "D.device", record);

    const D = strict(
        {
            success(variables, table) {
                report("success", undefined, variables, table);
            },
            failure(errorTypeArg) {
                report("failure", errorTypeArg);
            },
            createVariable: (uid, name, value, unit, vt) => ({ uid, name, value, unit, valueType: vt }),
            createMetric: (m) => Object.assign({}, m),
            createTable(label, columnHeaders) {
                const records = [];
                return {
                    label,
                    columnHeaders,
                    records,
                    insertRecord(id, values) {
                        records.push({ id, values });
                    }
                };
            },
            createBackup: (backup) => ({
                label: (backup && backup.label) || "Custom Driver Configuration Backup",
                running: backup && backup.running,
                startup: backup && typeof backup.startup === "string" ? backup.startup : null,
                ignoredLines: (backup && backup.ignoredLines) || null
            }),
            getParameter: (name) => (Object.prototype.hasOwnProperty.call(parameters, name) ? parameters[name] : null),
            htmlParse: cheerio.load,
            createExternalDevice: (host) => strict(deviceSurface(host), "D.createExternalDevice", record),
            crypto,
            _unsafe: {
                buffer: {
                    from: (data, offsetOrEncoding, length) => Buffer.from(data, offsetOrEncoding, length),
                    alloc: (length, fill, encoding) => Buffer.alloc(length, fill, encoding),
                    concat: (list, length) => Buffer.concat(list, length)
                }
            },
            _: lodash,
            math: {
                percent: (actual, maximum) => Math.round((10000.0 * parseInt(actual, 10)) / parseInt(maximum, 10)) / 100
            },
            errorType,
            valueType,
            deviceProperty,
            tftpServer: {
                accept: (options, onReady, onUploadEnd) => transport("tftp", "accept", "tftp.accept")(options, onReady, onUploadEnd)
            },
            device
        },
        "D",
        record
    );

    return { D, record };
}

module.exports = { createFakeD };
