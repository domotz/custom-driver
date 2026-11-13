var harnessLib = require("./helpers/mock-d");

// http/generic_monitoring.js previously used eval() in two places:
//   - parse():           result = eval(config.valueExtractor)   (JSON responses)
//   - valueValidation():  config.validation = eval(config.valueValidation)
//
// After the eval removal the driver supports, securely:
//   - JSON valueExtractor as a safe property path string ("value.a.b", "value[0].x",
//     "value['key']") OR a user function.
//   - valueValidation as a user function only (default: function (value) { return !!value; }).
//
// These tests pin both the preserved behavior and the security guarantees.

function jsonConfig(extractor, body) {
    return {
        responseType: "json",
        valueExtractor: extractor,
        responseBody: JSON.stringify(body)
    };
}

describe("http/generic_monitoring driver", function () {
    var harness, driver;

    beforeEach(function () {
        harness = harnessLib.createMockD();
        driver = harnessLib.loadDriver("http/generic_monitoring.js", harness);
    });

    describe("parse() JSON value extraction by path", function () {
        it("should resolve a dotted path", function () {
            expect(driver.parse(jsonConfig("value.a.b", { a: { b: 42 } })).result).toEqual(42);
        });

        it("should resolve an indexed path", function () {
            var config = jsonConfig("value.items[1].name", { items: [{ name: "x" }, { name: "y" }] });
            expect(driver.parse(config).result).toEqual("y");
        });

        it("should resolve a bracket-quoted key", function () {
            expect(driver.parse(jsonConfig("value['weird key'].x", { "weird key": { x: 5 } })).result).toEqual(5);
        });

        it("should return undefined for a missing path instead of throwing", function () {
            expect(driver.parse(jsonConfig("value.nope.deep", { a: 1 })).result).toBeUndefined();
        });

        it("should still support a user-supplied extractor function", function () {
            var config = {
                responseType: "json",
                valueExtractor: function (value) { return value.z; },
                responseBody: JSON.stringify({ z: 9 })
            };
            expect(driver.parse(config).result).toEqual(9);
        });
    });

    describe("parse() JSON extractor security", function () {
        it("should NOT execute arbitrary code in an extractor string", function () {
            // If eval were still in use, this assignment would run against the
            // sandbox's D object. The safe path resolver must never execute it.
            var config = jsonConfig("D.__pwned__ = 'x'", { a: 1 });
            var result = driver.parse(config).result;

            expect(harness.D.__pwned__).toBeUndefined();
            expect(typeof result).not.toEqual("string");
        });

        it("should NOT invoke methods referenced in an extractor string", function () {
            // "value.toString()" under eval returns "[object Object]"; the resolver
            // must treat toString as a property lookup, never call it.
            var result = driver.parse(jsonConfig("value.toString()", { a: 1 })).result;
            expect(result).not.toEqual("[object Object]");
        });
    });

    describe("valueValidation()", function () {
        it("should run a user-supplied validation function", function () {
            var config = { result: 15, valueValidation: function (value) { return value > 10; } };
            expect(driver.valueValidation(config).validation).toBeTrue();
        });

        it("should run the default validation set by configValidation (!!value)", function () {
            var truthy = driver.configValidation({ id: "a", link: "/a", responseType: "json", valueExtractor: "value.x" }, 0);
            truthy.result = "something";
            expect(driver.valueValidation(truthy).validation).toBeTrue();

            var falsy = driver.configValidation({ id: "b", link: "/b", responseType: "json", valueExtractor: "value.x" }, 1);
            falsy.result = "";
            expect(driver.valueValidation(falsy).validation).toBeFalse();
        });
    });

    describe("configValidation()", function () {
        it("should default valueValidation to a function (not a string)", function () {
            var config = driver.configValidation({ id: "a", link: "/a", responseType: "json", valueExtractor: "value.x" }, 0);
            expect(typeof config.valueValidation).toEqual("function");
        });

        it("should reject a string valueValidation with a PARSING_ERROR", function () {
            driver.configValidation({
                id: "a", link: "/a", responseType: "json", valueExtractor: "value.x",
                valueValidation: "!!value"
            }, 0);

            var parsingErrors = harness.calls.failure.filter(function (f) {
                return f.errorType === "PARSING_ERROR";
            });
            expect(parsingErrors.length).toBeGreaterThan(0);
        });
    });
});
