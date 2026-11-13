var harnessLib = require("./helpers/mock-d");

// SNMP exemplar: snmp/apc_ups_temperature_humidity.js
// Transport: D.device.createSNMPSession().walk(oid, function (out, err) {...})
// This driver has no standalone pure parser, so it is tested end-to-end.

var NAME_OID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.2.1";
var TEMP_OID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.4.1";
var UNITS_OID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.5.1";
var HUMIDITY_OID = "1.3.6.1.4.1.318.1.1.10.2.3.2.1.6.1";

function walkResult(units) {
    var out = {};
    out[NAME_OID] = "Probe A";
    out[TEMP_OID] = 23;
    out[UNITS_OID] = units;
    out[HUMIDITY_OID] = 45;
    return out;
}

describe("snmp/apc_ups_temperature_humidity driver", function () {
    describe("get_status()", function () {
        it("should report name, temperature and humidity in Celsius when units != 2", async function () {
            var harness = harnessLib.createMockD({
                snmp: { walk: function () { return { out: walkResult(1) }; } }
            });
            var driver = harnessLib.loadDriver("snmp/apc_ups_temperature_humidity.js", harness);

            driver.get_status();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
            var byUid = {};
            harness.calls.createVariable.forEach(function (v) { byUid[v.uid] = v; });
            expect(byUid.probe_name.value).toEqual("Probe A");
            expect(byUid.probe_temperature.value).toEqual(23);
            expect(byUid.probe_temperature.unit).toEqual("C");
            expect(byUid.probe_humidity.value).toEqual(45);
            expect(byUid.probe_humidity.unit).toEqual("%");
        });

        it("should report temperature in Fahrenheit when units == 2", async function () {
            var harness = harnessLib.createMockD({
                snmp: { walk: function () { return { out: walkResult(2) }; } }
            });
            var driver = harnessLib.loadDriver("snmp/apc_ups_temperature_humidity.js", harness);

            driver.get_status();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
            var temp = harness.calls.createVariable.filter(function (v) {
                return v.uid === "probe_temperature";
            })[0];
            expect(temp.unit).toEqual("F");
        });

        it("should fail with PARSING_ERROR when a required OID is missing", async function () {
            var partial = walkResult(1);
            delete partial[HUMIDITY_OID];
            var harness = harnessLib.createMockD({
                snmp: { walk: function () { return { out: partial }; } }
            });
            var driver = harnessLib.loadDriver("snmp/apc_ups_temperature_humidity.js", harness);

            driver.get_status();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("failure");
            expect(outcome.errorType).toBe("PARSING_ERROR");
        });

        it("should fail with GENERIC_ERROR when the SNMP walk errors", async function () {
            var harness = harnessLib.createMockD({
                snmp: { walk: function () { return { error: new Error("timeout") }; } }
            });
            var driver = harnessLib.loadDriver("snmp/apc_ups_temperature_humidity.js", harness);

            driver.get_status();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("failure");
            expect(outcome.errorType).toBe("GENERIC_ERROR");
        });
    });

    describe("validate()", function () {
        it("should succeed when all probe OIDs are present", async function () {
            var harness = harnessLib.createMockD({
                snmp: { walk: function () { return { out: walkResult(1) }; } }
            });
            var driver = harnessLib.loadDriver("snmp/apc_ups_temperature_humidity.js", harness);

            driver.validate();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
        });
    });
});
