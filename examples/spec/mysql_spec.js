global.D = {
    device: {
        createVariable: function () {
        }
    }
};


describe("MySQL driver testing", function () {
    describe("Output parsing", function () {
        var parse = require("../ssh/mysql").parse;
        it("Should handle gracefully a total failure", function () {
            var result = parse(outputTotalFail);
            expect(result).toEqual({
                errors: "No service information (mysql: unrecognized service)\n" +
                    "No memory usage information (sh: 1: pmap: not found)\n" +
                    "No admin information (error: 'Access denied for user 'root'@'localhost' (using password: NO)')"
            });
        });

        it("Should handle gracefully a partial failure", function () {
            var result = parse(outputAdminFail);
            expect(result).toEqual({
                errors: "No admin information (error: 'Access denied for user 'root'@'localhost' (using password: NO)')",
                status: "active (running)",
                usedRam: 1630956
            });
        });

        it("Should handle gracefully a shutdown", function () {
            var result = parse(outputShutdown);
            expect(result).toEqual({
                errors: "No memory usage information (cat: /var/run/mysqld/mysqld.pid: No such file or directory)\n" +
                    "No admin information (Check that mysqld is running and that the socket: '/var/run/mysqld/mysqld.sock' exists!)",
                status: "inactive (dead)"
            });
        });

        it("Should successfully parse a correct output", function () {
            var result = parse(outputSuccess);
            expect(result.errors).toEqual("");
            expect(result).toEqual({
                errors: "",
                status: "active (running)",
                version: "5.5.62-0+deb8u1",
                usedRam: 681660,
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

        it("Should successfully parse a mysqladmin success", function () {
            var result = parse(outputPartialSuccess);
            expect(result).toEqual({
                errors: "No service information (mysql: unrecognized service)\n" +
                    "No memory usage information (sh: 1: pmap: not found)",
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
    });

    describe("Running detection", function () {
        var isRunning = require("../ssh/mysql").isRunning;
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
        var toHours = require("../ssh/mysql").toHours;
        it("Should parse seconds", function () {
            expect(toHours("4 sec")).toEqual("0");
        });
        it("Should parse minutes seconds", function () {
            result = toHours("5 min 4 sec");
            expect(result).toEqual("0.08");
        });
        it("Should parse hours minutes seconds", function () {
            result = toHours("6 hours 5 min 4 sec");
            expect(result).toEqual("6.08");
        });
        it("Should parse days hours minutes seconds", function () {
            result = toHours("7 days 6 hours 5 min 4 sec");
            expect(result).toEqual("174.08");
        });
    });
});

var outputSuccess = "   Active: active (running) since Thu 2022-05-19 08:23:29 CEST; 5min ago\n" +
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


var outputPartialSuccess = "mysql: unrecognized service\n" +
    "sh: 1: pmap: not found\n" +
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

var outputTotalFail = "mysql: unrecognized service\n" +
    "sh: 1: pmap: not found\n" +
    "mysqladmin: connect to server at 'localhost' failed\n" +
    "error: 'Access denied for user 'root'@'localhost' (using password: NO)'";

var outputAdminFail = "   Active: active (running) since Wed 2022-05-18 22:09:24 UTC; 9h ago\n" +
    " total          1630956K\n" +
    "mysqladmin: connect to server at 'localhost' failed\n" +
    "error: 'Access denied for user 'root'@'localhost' (using password: NO)'";

var outputShutdown = "   Active: inactive (dead) since Thu 2022-05-19 11:30:33 CEST; 10min ago\n" +
    "cat: /var/run/mysqld/mysqld.pid: No such file or directory\n" +
    "mysqladmin: connect to server at 'localhost' failed\n" +
    "error: 'Can't connect to local MySQL server through socket '/var/run/mysqld/mysqld.sock' (2)'\n" +
    "Check that mysqld is running and that the socket: '/var/run/mysqld/mysqld.sock' exists!";