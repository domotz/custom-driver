/**
 * Test harness for Domotz custom driver examples.
 *
 * The example drivers are not written to be `require`d: they have no
 * `module.exports` and they execute top-level code against a global `D`
 * (the Domotz sandbox SDK) the moment they load. This harness:
 *
 *   1. createMockD(options) - builds a fake `D` that records every
 *      createVariable / success / failure call and lets a test script the
 *      output of each transport (SSH, HTTP, SNMP, Telnet, WinRM).
 *   2. loadDriver(relativePath, harness) - reads a driver's source and runs
 *      it inside a `vm` context seeded with the mock `D`. Because top-level
 *      `function` / `var` declarations attach to the context object, the
 *      returned sandbox exposes both the driver's pure helpers (parse, etc.)
 *      and its remote procedures (validate, get_status) - with zero edits to
 *      the example files.
 *
 * Async drivers resolve `D.success` / `D.failure` on the microtask queue, so
 * `harness.completion` is a promise that settles with the terminal outcome.
 * Full-procedure tests do:  driver.get_status(); var out = await harness.completion;
 */

var fs = require("fs");
var path = require("path");
var vm = require("vm");

var EXAMPLES_ROOT = path.resolve(__dirname, "..", "..");

// A q-compatible deferred backed by a native Promise (drivers use
// D.q.defer() then .resolve()/.reject()/.promise with .then()/.catch()).
function makeQ() {
    return {
        defer: function () {
            var deferred = {};
            deferred.promise = new Promise(function (resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
            return deferred;
        },
        all: function (promises) {
            return Promise.all(promises);
        }
    };
}

function createMockD(options) {
    options = options || {};

    var calls = {
        createVariable: [],
        success: [],
        failure: [],
        console: [],
        tables: [],
        tableRecords: []
    };

    var resolveCompletion;
    var completion = new Promise(function (resolve) {
        resolveCompletion = resolve;
    });

    function settle(outcome) {
        resolveCompletion(outcome);
    }

    function createVariable(uid, label, value, unit, valueType) {
        var variable = {
            uid: uid,
            label: label,
            value: value,
            unit: unit,
            valueType: valueType
        };
        calls.createVariable.push(variable);
        return variable;
    }

    // Wraps a test-supplied responder into a transport with the callback
    // signature the real SDK uses. `argsFor` maps the responder's return
    // value to the positional callback arguments for that protocol.
    function transport(responder, argsFor) {
        return function (config, callback) {
            var result = responder ? responder(config) : {};
            callback.apply(null, argsFor(result || {}));
        };
    }

    var D = {
        q: makeQ(),

        errorType: {
            AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
            RESOURCE_UNAVAILABLE: "RESOURCE_UNAVAILABLE",
            GENERIC_ERROR: "GENERIC_ERROR",
            PARSING_ERROR: "PARSING_ERROR",
            TIMEOUT_ERROR: "TIMEOUT_ERROR"
        },

        valueType: {
            NUMBER: "NUMBER",
            STRING: "STRING",
            DATETIME: "DATETIME",
            RATE: "RATE",
            MONOTONE_RATE: "MONOTONE_RATE"
        },

        createVariable: createVariable,

        createTable: function (id, columns) {
            var table = {
                id: id,
                columns: columns,
                records: [],
                insertRecord: function (recordId, values) {
                    var record = { id: recordId, values: values };
                    table.records.push(record);
                    calls.tableRecords.push(record);
                }
            };
            calls.tables.push(table);
            return table;
        },

        createExternalDevice: function () {
            // External devices share the same mocked HTTP transport.
            return { http: D.device.http };
        },

        getParameter: function (name) {
            var params = options.parameters || {};
            return Object.prototype.hasOwnProperty.call(params, name) ? params[name] : null;
        },

        htmlParse: options.htmlParse || function () {
            throw new Error("D.htmlParse was called but no htmlParse stub was provided");
        },

        success: function (variables) {
            var outcome = { type: "success", variables: variables == null ? null : variables };
            calls.success.push(outcome);
            settle(outcome);
        },

        failure: function (errorType) {
            var outcome = { type: "failure", errorType: errorType };
            calls.failure.push(outcome);
            settle(outcome);
        },

        device: {
            username: function () { return options.username == null ? "user" : options.username; },
            password: function () { return options.password == null ? "pass" : options.password; },
            createVariable: createVariable,

            // SDK callback: (output, error)
            sendSSHCommand: transport(options.ssh, function (r) {
                return [r.output, r.error];
            }),

            // SDK callback: (output, error)
            sendTelnetCommand: transport(options.telnet, function (r) {
                return [r.output, r.error];
            }),

            // SDK callback: (output) where output carries .error/.outcome/.code
            sendWinRMCommand: transport(options.winrm, function (r) {
                return [r];
            }),

            // SDK callback: (error, response, body)
            http: {
                get: transport(options.http && options.http.get, function (r) {
                    return [r.error, r.response, r.body];
                }),
                post: transport(options.http && options.http.post, function (r) {
                    return [r.error, r.response, r.body];
                })
            },

            // session.walk / session.get callback: (out, error)
            createSNMPSession: function () {
                return {
                    walk: transport(options.snmp && options.snmp.walk, function (r) {
                        return [r.out, r.error];
                    }),
                    get: transport(options.snmp && options.snmp.get, function (r) {
                        return [r.out, r.error];
                    })
                };
            }
        }
    };

    return { D: D, calls: calls, completion: completion };
}

function loadDriver(relativePath, harness) {
    var fullPath = path.resolve(EXAMPLES_ROOT, relativePath);
    var source = fs.readFileSync(fullPath, "utf8");

    function recordConsole(level) {
        return function () {
            harness.calls.console.push({
                level: level,
                args: Array.prototype.slice.call(arguments)
            });
        };
    }

    var sandbox = {
        D: harness.D,
        console: {
            log: recordConsole("log"),
            info: recordConsole("info"),
            warn: recordConsole("warn"),
            error: recordConsole("error")
        },
        setTimeout: setTimeout,
        clearTimeout: clearTimeout
    };

    vm.runInNewContext(source, sandbox, { filename: relativePath });
    return sandbox;
}

module.exports = {
    createMockD: createMockD,
    loadDriver: loadDriver
};
