var harnessLib = require("./helpers/mock-d");

// Telnet exemplar: telnet/redis_stats.js
// Transport: D.device.sendTelnetCommand(params, function (out, err) {...})

var infoOutput = [
    "# Clients",
    "connected_clients:10",
    "maxclients:1000",
    "# Persistence",
    "loading:0",
    "rdb_changes_since_last_save:5",
    "# Stats",
    "total_connections_received:42",
    "instantaneous_ops_per_sec:7",
    "uptime_in_seconds_human:42 days" // *_human keys are filtered out
].join("\n");

describe("telnet/redis_stats driver", function () {
    var driver;
    beforeEach(function () {
        driver = harnessLib.loadDriver("telnet/redis_stats.js", harnessLib.createMockD());
    });

    describe("splitToSections()", function () {
        it("should group INFO lines by their '# Section' header, prefixed by section", function () {
            var grouped = driver.splitToSections(infoOutput.split("\n"));
            expect(grouped.clients).toEqual([
                "clients>connected_clients:10",
                "clients>maxclients:1000"
            ]);
            expect(grouped.stats).toContain("stats>total_connections_received:42");
        });
    });

    describe("parseInfo()", function () {
        it("should produce a variable per metric and drop *_human keys", function () {
            var grouped = driver.splitToSections(infoOutput.split("\n"));
            var variables = driver.parseInfo(grouped);

            var byUid = {};
            variables.forEach(function (v) { byUid[v.uid] = v; });

            expect(byUid["clients>connected_clients"].value).toEqual("10");
            expect(byUid["stats>instantaneous_ops_per_sec"].value).toEqual("7");
            // Human-readable duplicate is excluded.
            expect(byUid["stats>uptime_in_seconds_human"]).toBeUndefined();
            // Label replaces underscores with spaces.
            expect(byUid["persistence>rdb_changes_since_last_save"].label)
                .toEqual("persistence>rdb changes since last save");
        });
    });

    describe("get_status() full procedure", function () {
        it("should report variables from a successful telnet INFO response", async function () {
            var harness = harnessLib.createMockD({
                telnet: function () { return { output: infoOutput }; }
            });
            var d = harnessLib.loadDriver("telnet/redis_stats.js", harness);

            d.get_status();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
            var uids = harness.calls.createVariable.map(function (v) { return v.uid; });
            expect(uids).toContain("clients>connected_clients");
            expect(uids).toContain("stats>total_connections_received");
        });
    });
});
