var harnessLib = require("./helpers/mock-d");

// HTTP exemplar: http/domotz_box_system_restart.js
// "Restart Now" (custom_1) must report a failure whenever the Collector did not accept the restart (BT-7074).

function runRestart(reply) {
    var harness = harnessLib.createMockD({
        http: {
            post: function () {
                return reply;
            }
        }
    });
    var driver = harnessLib.loadDriver("http/domotz_box_system_restart.js", harness);
    driver.custom_1();
    return harness.completion;
}

describe("http/domotz_box_system_restart driver custom_1()", function () {
    it("should succeed when the Collector accepts the restart", async function () {
        var outcome = await runRestart({ response: { statusCode: 200 }, body: "{\"error\":null}" });
        expect(outcome.type).toBe("success");
    });

    it("should fail with RESOURCE_UNAVAILABLE when the route is missing (local web interface disabled)", async function () {
        var outcome = await runRestart({ response: { statusCode: 404 }, body: "Not Found" });
        expect(outcome).toEqual({ type: "failure", errorType: "RESOURCE_UNAVAILABLE" });
    });

    it("should fail with GENERIC_ERROR on any other non-2xx status", async function () {
        var outcome = await runRestart({ response: { statusCode: 500 }, body: "" });
        expect(outcome).toEqual({ type: "failure", errorType: "GENERIC_ERROR" });
    });

    it("should fail with RESOURCE_UNAVAILABLE when the Collector answers 200 with an error", async function () {
        var outcome = await runRestart({
            response: { statusCode: 200 },
            body: "{\"error\":\"System reboot is disabled for this platform\"}"
        });
        expect(outcome).toEqual({ type: "failure", errorType: "RESOURCE_UNAVAILABLE" });
    });

    it("should fail with GENERIC_ERROR on a transport error", async function () {
        var outcome = await runRestart({ error: new Error("ECONNREFUSED") });
        expect(outcome).toEqual({ type: "failure", errorType: "GENERIC_ERROR" });
    });
});
