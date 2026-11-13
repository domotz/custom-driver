/**
 * Strict fake of the Domotz sandbox global `D` for the driver robustness net.
 *
 * Mirrors remote_pawn_ng/src/sandbox (context.js, library/*). Reads of members
 * that production does not have throw, so a driver relying on a missing API
 * fails loudly instead of silently getting `undefined`.
 *
 * createFakeD({ responder, parameters, schedule, device, driverType }) -> { D, record }
 *   driverType GENERIC (default) or CONFIGURATION_MANAGEMENT selects how D.success behaves (sandbox.js buildDomotzContext)
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

// Record validation of Table.insertRecord, mirroring remote_pawn_ng src/sandbox/library/table.js:
// insertRecord (:226) builds { value, metadata: null } with for...of and calls addMetrics (:201),
// which runs validateInsertRecord (:85-141: id string 1..50 not matching a reserved path segment,
// value count equal to the column count, no value over 500 characters) and then rejects a duplicate
// id (:207). Limits: MAX_RECORD_ID_LEN (table.js:33), validUidRegex and maxMetricLength
// (constants.js:120, :133). Same order and messages; production throws Error(message).
const MAX_RECORD_ID_LEN = 50;
const MAX_METRIC_LENGTH = 500;
const VALID_UID_RE = /^((?!((\/|^)(table|column|history)(\/|$))).)*$/;
const RECORD_ID_MESSAGE = "Defined record id must be a string with max length: " + MAX_RECORD_ID_LEN;

function validateRecordId(id) {
    if (typeof id !== "string" || id.length < 1 || id.length > MAX_RECORD_ID_LEN) {
        throw Error(RECORD_ID_MESSAGE);
    }
    if (!VALID_UID_RE.test(id)) {
        throw Error("Defined record id '" + id + "' is a reserved word");
    }
}

function validateRecordValues(metrics, columnHeadersLength) {
    if (metrics.length !== columnHeadersLength) {
        throw Error("Defined column header size is different than inserted values size: " + columnHeadersLength + " != " + metrics.length);
    }
    metrics.forEach((item, index) => {
        if (item.value !== undefined && item.value !== null && String(item.value).length > MAX_METRIC_LENGTH) {
            throw Error("Record cannot contain a value that exceeds 500 characters (index: " + index + ")");
        }
    });
}

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
    const configurationManagement = config.driverType === "CONFIGURATION_MANAGEMENT";
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
            const invoke = (fn, fnArgs) => () => {
                try {
                    fn(...fnArgs);
                } catch (error) {
                    if (WRAPPED.has(wrapKey)) {
                        record.wrappedThrows.push({ method: where, error });
                        report("failure", "GENERIC_ERROR");
                    } else {
                        record.crashes.push({ where, error });
                    }
                }
            };
            schedule(invoke(callback, args));
            // tftpServer.accept: a reply may carry the onUploadEnd(error, content) arguments too
            const onUploadEnd = rest.filter((arg) => typeof arg === "function")[1];
            if (onUploadEnd && Array.isArray(args.onUploadEnd)) {
                schedule(invoke(onUploadEnd, args.onUploadEnd));
            }
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
            // sandbox.js successGeneric: a table passed first is the table; variables are then
            // iterated with for...of (7.4.3+, BT-6098), so a non-iterable throws a TypeError back
            // into the driver, and a duplicate uid reports PARSING_ERROR instead of the success.
            // successConfigurationManagement takes the backup as is.
            success(variables, table) {
                if (configurationManagement) {
                    report("success", undefined, variables, table);
                    return;
                }
                if (!table && variables && variables.isTable) {
                    table = variables;
                    variables = null;
                }
                if (variables !== null && variables !== undefined) {
                    const uids = [];
                    for (const variable of variables) {
                        const uid = variable.uid;
                        if (uids.includes(uid)) {
                            report("failure", "PARSING_ERROR");
                            return;
                        }
                        uids.push(uid);
                    }
                }
                report("success", undefined, variables, table);
            },
            failure(errorTypeArg) {
                report("failure", errorTypeArg);
            },
            createVariable: (uid, name, value, unit, vt) => ({ uid, name, value, unit, valueType: vt }),
            createMetric: (m) => Object.assign({}, m),
            createTable(label, columnHeaders) {
                const records = [];
                const table = {
                    isTable: true,
                    label,
                    columnHeaders,
                    records,
                    // library/table.js addMetrics: [{ value, metadata }]; a record keeps metadata only when some is set.
                    addMetrics(id, metrics) {
                        validateRecordId(id);
                        validateRecordValues(metrics, (columnHeaders || []).length);
                        if (records.some((r) => r.id === id)) {
                            throw Error("Duplicate record id. Cannot insert record: " + id);
                        }
                        const record = { id, values: metrics.map((m) => m.value) };
                        if (metrics.some((m) => m.metadata !== null && m.metadata !== undefined)) {
                            record.metadata = metrics.map((m) => (m.metadata === undefined ? null : m.metadata));
                        }
                        records.push(record);
                    },
                    insertRecord(id, values) {
                        // Production builds the metrics with for...of (a non-iterable throws a TypeError).
                        const metrics = [];
                        for (const value of values) {
                            metrics.push({ value, metadata: null });
                        }
                        table.addMetrics(id, metrics);
                    },
                    // library/table.js upsertRecord: an existing id keeps its position and gets the new values.
                    upsertRecord(id, values) {
                        const metrics = [];
                        for (const value of values) {
                            metrics.push({ value, metadata: null });
                        }
                        validateRecordId(id);
                        validateRecordValues(metrics, (columnHeaders || []).length);
                        const existing = records.find((r) => r.id === id);
                        if (existing) {
                            existing.values = values;
                        } else {
                            records.push({ id, values });
                        }
                    }
                };
                return table;
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
