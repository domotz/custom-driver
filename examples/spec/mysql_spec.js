var mockD = require("./helpers/mock-d");

// The driver has no module.exports and runs top-level code against D, so it is
// loaded through the vm harness, which exposes its functions on the sandbox.
var driver = mockD.loadDriver("ssh/mysql.js", mockD.createMockD());

// Pins current behaviour. usedRam is never parsed because parse() expects the pmap line first but the command prints the service status line first. Listed under known issues in spec/README.md.
describe("MySQL driver testing", function () {
    describe("Output parsing", function () {
        var parse = driver.parse;
        var memoryError = "No memory usage information (Active: active (running) since Thu 2022-05-19 08:23:29 CEST; 5min ago)";

        it("Should parse mysqladmin data but not usedRam from the driver's own command output", function () {
            var result = parse(outputSuccess);
            expect(result.usedRam).toBeUndefined();
            expect(result).toEqual({
                errors: memoryError,
                version: "5.5.62-0+deb8u1",
                uptime: "5 min 19 sec",
                threads: 1,
                questions: 1150,
                slowQueries: 1,
                opens: 113,
                flushTables: 1,
                openTables: 106,
                queriesS: "3.605"
            });
        });

        it("Should report the service line as the memory error when no service is found", function () {
            var result = parse(outputNoService);
            expect(result.usedRam).toBeUndefined();
            expect(result).toEqual({
                errors: "No memory usage information (No service found)",
                version: "8.0.29",
                uptime: "13 sec",
                threads: 2,
                questions: 2,
                slowQueries: 0,
                opens: 117,
                flushTables: 3,
                openTables: 36,
                queriesS: "0.153"
            });
        });

        it("Should parse mysqladmin data when no pid is found", function () {
            var result = parse(outputNoPid);
            expect(result.usedRam).toBeUndefined();
            expect(result.errors).toEqual(memoryError);
            expect(result.version).toEqual("5.5.62-0+deb8u1");
            expect(result.threads).toEqual(1);
        });

        it("Should report an admin error when mysqladmin cannot run", function () {
            var result = parse(outputAdminFail);
            expect(result.usedRam).toBeUndefined();
            expect(result.version).toBeUndefined();
            expect(result.errors).toEqual(memoryError + "\n" + "No admin information (Cannot run mysqladmin)");
        });

        it("Should report both errors on a total failure", function () {
            var result = parse(outputTotalFail);
            expect(result.usedRam).toBeUndefined();
            expect(result.errors).toContain("No memory usage information");
            expect(result.errors).toContain("No admin information");
        });
    });

    describe("Running detection", function () {
        var isRunning = driver.isRunning;
        it("Should mark as running if version is detected", function () {
            expect(isRunning({ version: "foo" })).toBeTrue();
        });
        it("Should mark as running if used ram is detected", function () {
            expect(isRunning({ usedRam: 1000 })).toBeTrue();
        });
        it("Should mark as running if status is running", function () {
            expect(isRunning({ status: "active (running)" })).toBeTrue();
        });
        it("Should mark as not running if status is exited", function () {
            expect(isRunning({ status: "inactive (dead)" })).toBeFalse();
        });
    });

    describe("Time parsing", function () {
        var toHours = driver.toHours;
        it("Should parse seconds", function () {
            expect(toHours("4 sec")).toEqual("0");
        });
        it("Should parse minutes seconds", function () {
            var result = toHours("5 min 4 sec");
            expect(result).toEqual("0.08");
        });
        it("Should parse hours minutes seconds", function () {
            var result = toHours("6 hours 5 min 4 sec");
            expect(result).toEqual("6.08");
        });
        it("Should parse days hours minutes seconds", function () {
            var result = toHours("7 days 6 hours 5 min 4 sec");
            expect(result).toEqual("174.08");
        });
    });
});

var activeLine = "   Active: active (running) since Thu 2022-05-19 08:23:29 CEST; 5min ago\n";

var outputSuccess = activeLine +
    " total           681660K\n" +
    "mysqladmin  Ver 8.42 Distrib 5.5.62, for debian-linux-gnu on x86_64\n" +
    "Copyright (c) 2000, 2018, Oracle and/or its affiliates. All rights reserved.\n" +
    "\n" +
    "Oracle is a registered trademark of Oracle Corporation and/or its\n" +
    "affiliates. Other names may be trademarks of their respective\n" +
    "owners.\n" +
    "\n" +
    "Server version          5.5.62-0+deb8u1\n" +
    "Protocol version        10\n" +
    "Connection              Localhost via UNIX socket\n" +
    "UNIX socket             /var/run/mysqld/mysqld.sock\n" +
    "Uptime:                 5 min 19 sec\n" +
    "\n" +
    "Threads: 1  Questions: 1150  Slow queries: 1  Opens: 113  Flush tables: 1  Open tables: 106  Queries per second avg: 3.605";

var outputNoService = "No service found\n" +
    " total           681660K\n" +
    "mysqladmin  Ver 8.0.29 for Linux on x86_64 (MySQL Community Server - GPL)\n" +
    "Copyright (c) 2000, 2022, Oracle and/or its affiliates.\n" +
    "\n" +
    "Oracle is a registered trademark of Oracle Corporation and/or its\n" +
    "affiliates. Other names may be trademarks of their respective\n" +
    "owners.\n" +
    "\n" +
    "Server version          8.0.29\n" +
    "Protocol version        10\n" +
    "Connection              Localhost via UNIX socket\n" +
    "UNIX socket             /var/run/mysqld/mysqld.sock\n" +
    "Uptime:                 13 sec\n" +
    "\n" +
    "Threads: 2  Questions: 2  Slow queries: 0  Opens: 117  Flush tables: 3  Open tables: 36  Queries per second avg: 0.153";

var outputNoPid = activeLine +
    "No pid found\n" +
    "mysqladmin  Ver 8.42 Distrib 5.5.62, for debian-linux-gnu on x86_64\n" +
    "Copyright (c) 2000, 2018, Oracle and/or its affiliates. All rights reserved.\n" +
    "\n" +
    "Oracle is a registered trademark of Oracle Corporation and/or its\n" +
    "affiliates. Other names may be trademarks of their respective\n" +
    "owners.\n" +
    "\n" +
    "Server version          5.5.62-0+deb8u1\n" +
    "Protocol version        10\n" +
    "Connection              Localhost via UNIX socket\n" +
    "UNIX socket             /var/run/mysqld/mysqld.sock\n" +
    "Uptime:                 5 min 19 sec\n" +
    "\n" +
    "Threads: 1  Questions: 1150  Slow queries: 1  Opens: 113  Flush tables: 1  Open tables: 106  Queries per second avg: 3.605";

var outputAdminFail = activeLine +
    " total          1630956K\n" +
    "mysqladmin: connect to server at '127.0.0.1' failed\n" +
    "error: 'Access denied for user 'root'@'localhost' (using password: YES)'\n" +
    "Cannot run mysqladmin";

var outputTotalFail = "No service found\n" +
    "No pid found\n" +
    "mysqladmin: connect to server at '127.0.0.1' failed\n" +
    "error: 'Access denied for user 'root'@'localhost' (using password: YES)'\n" +
    "Cannot run mysqladmin";
