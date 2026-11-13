var harnessLib = require("./helpers/mock-d");

// HTTP exemplar: http/apache2_status.js
// Transport: D.device.http.get(opts, function (error, response, body) {...})

var statusBody = [
    "Total Accesses: 1000",
    "Total kBytes: 2048",
    "CPULoad: .5",
    "Uptime: 3600",
    "ServerVersion: Apache/2.4.41 (Ubuntu)",
    "ServerMPM: event",
    "Load1: .1",
    "Load5: .2",
    "Load15: .3",
    "BusyWorkers: 2",
    "Scoreboard: __WW.."
].join("\n");

describe("http/apache2_status driver", function () {
    describe("convertToJson()", function () {
        var driver;
        beforeEach(function () {
            driver = harnessLib.loadDriver("http/apache2_status.js", harnessLib.createMockD());
        });

        it("should turn the server-status text into typed key/value pairs", function () {
            var json = driver.convertToJson(statusBody);
            expect(json.ServerVersion).toEqual("Apache/2.4.41 (Ubuntu)");
            expect(json.CPULoad).toEqual(0.5);
            expect(json["Total Accesses"]).toEqual(1000);
            // Uptime is mirrored onto ServerUptimeSeconds.
            expect(json.ServerUptimeSeconds).toEqual(3600);
        });

        it("should count workers from the Scoreboard string", function () {
            var json = driver.convertToJson(statusBody);
            expect(json.Workers.waiting).toEqual(2); // two "_"
            expect(json.Workers.sending).toEqual(2); // two "W"
            expect(json.Workers.slot).toEqual(2);    // two "."
        });
    });

    describe("extractDataVariables() path resolution", function () {
        // Pins the property-path resolution that used to be done with eval(param.path),
        // across the path shapes present in parametersConfig: dotted, bracket-quoted
        // keys, and nested objects.
        var driver;
        var json = {
            ServerVersion: "Apache/2.4.41 (Ubuntu)",
            "Total kBytes": 2048,
            BusyWorkers: 2,
            Workers: {
                waiting: 2, starting: 0, reading: 0, sending: 2, keepalive: 0,
                dnslookup: 0, closing: 0, logging: 0, finishing: 0, cleanup: 0, slot: 2
            }
        };

        beforeEach(function () {
            driver = harnessLib.loadDriver("http/apache2_status.js", harnessLib.createMockD());
        });

        it("should resolve a dotted path (json.ServerVersion)", function () {
            var byUid = indexByUid(driver.extractDataVariables(json));
            expect(byUid.version.value).toEqual("Apache/2.4.41 (Ubuntu)");
        });

        it("should resolve a bracket-quoted key and apply postProcess (json['Total kBytes'] * 1024)", function () {
            var byUid = indexByUid(driver.extractDataVariables(json));
            expect(byUid.total_bytes.value).toEqual(2097152); // 2048 * 1024
        });

        it("should resolve a nested path (json.Workers.waiting / .sending)", function () {
            var byUid = indexByUid(driver.extractDataVariables(json));
            expect(byUid.workers_waiting_for_connection.value).toEqual(2);
            expect(byUid.workers_sending_reply.value).toEqual(2);
        });

        function indexByUid(variables) {
            var byUid = {};
            variables.forEach(function (v) { byUid[v.uid] = v; });
            return byUid;
        }
    });

    describe("get_status() full procedure", function () {
        it("should fetch, convert and report variables on a 200 response", async function () {
            var harness = harnessLib.createMockD({
                http: {
                    get: function () {
                        return { error: null, response: { statusCode: 200 }, body: statusBody };
                    }
                }
            });
            var driver = harnessLib.loadDriver("http/apache2_status.js", harness);

            driver.get_status();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
            var byUid = {};
            harness.calls.createVariable.forEach(function (v) { byUid[v.uid] = v; });
            expect(byUid.version.value).toEqual("Apache/2.4.41 (Ubuntu)");
            expect(byUid.cpu_load.value).toEqual(0.5);
            expect(byUid.cpu_load.unit).toEqual("%");
        });
    });

    describe("validate()", function () {
        it("should succeed when the status page is reachable", async function () {
            var harness = harnessLib.createMockD({
                http: {
                    get: function () {
                        return { error: null, response: { statusCode: 200 }, body: statusBody };
                    }
                }
            });
            var driver = harnessLib.loadDriver("http/apache2_status.js", harness);

            driver.validate();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
        });
    });
});
