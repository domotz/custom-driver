const { checkSuccess, normalizeReport, parseRange } = require("./success-check");
const { createReplay } = require("./replay");
const { deterministicGlobals, FIXED_NOW } = require("./clock");

describe("golden harness", () => {
    const table = (columns, records) => ({ isTable: true, label: "T", columnHeaders: columns.map((label) => ({ label })), records, insertRecord() {} });
    const success = (variables, t) => ({ firstReport: { type: "success", variables, table: t }, reports: [{ type: "success" }] });
    const variable = (uid, value) => ({ uid, name: uid, value });

    describe("checkSuccess", () => {
        it("accepts a valid success matching expected_variables", () => {
            const result = success([variable("a", "1"), variable("b", "2")]);
            expect(checkSuccess(result, { entryPoint: "get_status", companion: { expected_variables: { independent: "[2]" } } })).toEqual([]);
        });

        it("reports a failure instead of a success", () => {
            const result = { firstReport: { type: "failure", originalErrorType: "PARSING_ERROR" }, reports: [{}] };
            expect(checkSuccess(result, { entryPoint: "validate" })).toEqual(["expected D.success, got D.failure(PARSING_ERROR)"]);
        });

        it("reports production limits on variables", () => {
            const result = success([variable("x".repeat(51), "1"), variable("table", "1"), variable("v", "y".repeat(501)), variable("n", undefined)]);
            expect(checkSuccess(result, { entryPoint: "validate" })).toEqual([
                jasmine.stringContaining("uid must be a string of 1..50"),
                jasmine.stringContaining("uid is a reserved word"),
                jasmine.stringContaining("value longer than 500"),
                jasmine.stringContaining("no value")
            ]);
        });

        it("allows a listed null value and an allowed empty table", () => {
            const result = success([variable("n", null)], table(["A"], []));
            expect(checkSuccess(result, { entryPoint: "validate", expect: { nullValues: ["n"], allowEmptyTable: true } })).toEqual([]);
        });

        it("reports production limits on tables", () => {
            const result = success(null, table(["Id", "z".repeat(31)], []));
            expect(checkSuccess(result, { entryPoint: "validate" })).toEqual([
                jasmine.stringContaining("\"Id\" is reserved"),
                jasmine.stringContaining("label must be a string of 1..30"),
                jasmine.stringContaining("table has no records")
            ]);
        });

        it("checks the table column count against expected_variables on get_status only", () => {
            const result = success(null, table(["A", "B"], [{ id: "r", values: ["1", "2"] }]));
            const companion = { expected_variables: { table: "[3]" } };
            expect(checkSuccess(result, { entryPoint: "get_status", companion })).toEqual(["companion expected_variables.table = [3] but the driver reported 2"]);
            expect(checkSuccess(result, { entryPoint: "validate", companion })).toEqual([]);
        });

        it("checks a backup report and snapshots it as backup", () => {
            const backup = { label: "Custom Driver Configuration Backup", running: "hostname sw1", startup: null, ignoredLines: null };
            const result = { firstReport: { type: "success", variables: backup }, reports: [{ type: "success" }] };
            expect(checkSuccess(result, { entryPoint: "backup" })).toEqual([]);
            expect(normalizeReport(result.firstReport)).toEqual({ type: "success", backup });
            expect(checkSuccess(result, { entryPoint: "validate" })).toEqual([jasmine.stringContaining("reported a backup object from validate")]);
            const empty = { firstReport: { type: "success", variables: { label: "x", running: "" } }, reports: [{}] };
            expect(checkSuccess(empty, { entryPoint: "backup" })).toEqual([jasmine.stringContaining("backup must report")]);
        });

        it("reports more than one report", () => {
            const result = success(null);
            result.reports = [{ type: "success" }, { type: "failure", errorType: "GENERIC_ERROR" }];
            expect(checkSuccess(result, { entryPoint: "validate" })).toEqual(["reported 2 times: success, failure(GENERIC_ERROR)"]);
        });
    });

    it("parses expected_variables ranges", () => {
        expect(parseRange("[3]")).toEqual({ min: 3, max: 3 });
        expect(parseRange("[7,999]")).toEqual({ min: 7, max: 999 });
        expect(parseRange("3")).toBeNull();
    });

    describe("createReplay", () => {
        it("answers matching calls once and lists unexpected and unused calls", () => {
            const replay = createReplay([
                { kind: "ssh", method: "sendSSHCommand", target: "uptime", reply: ["up", null] },
                { kind: "http", method: "get", host: "api.example.com", target: /^\/v1\//, reply: [null, {}, ""] }
            ]);
            expect(replay.responder({ kind: "ssh", method: "sendSSHCommand", options: { command: "uptime" } })).toEqual(["up", null]);
            expect(replay.responder({ kind: "ssh", method: "sendSSHCommand", options: { command: "uptime" } })).toBeUndefined();
            expect(replay.responder({ kind: "http", method: "get", host: "other", options: { url: "/v1/x" } })).toBeUndefined();
            expect(replay.problems()).toEqual([
                "unexpected call ssh.sendSSHCommand \"uptime\"",
                "unexpected call http.get @other \"/v1/x\"",
                "expected call never made http.get /^\\/v1\\//"
            ]);
        });

        it("matches http headers when the fixture names them", () => {
            const replay = createReplay([{ kind: "http", method: "post", target: "/rest/lssystem", headers: { "X-Auth-Token": "t1" }, reply: [null, {}, ""] }]);
            expect(replay.responder({ kind: "http", method: "post", options: { url: "/rest/lssystem", headers: { "X-Auth-Token": "other" } } })).toBeUndefined();
            expect(replay.responder({ kind: "http", method: "post", options: { url: "/rest/lssystem", headers: { "X-Auth-Token": "t1" } } })).toEqual([null, {}, ""]);
        });

        it("matches http bodies when the fixture names them", () => {
            const replay = createReplay([
                { kind: "http", method: "post", target: "/sdk", body: /RetrieveServiceContent/, reply: ["a"] },
                { kind: "http", method: "post", target: "/sdk", body: "{\"q\":1}", reply: ["b"] }
            ]);
            expect(replay.responder({ kind: "http", method: "post", options: { url: "/sdk", body: { q: 1 } } })).toEqual(["b"]);
            expect(replay.responder({ kind: "http", method: "post", options: { url: "/sdk", body: "<Login/>" } })).toBeUndefined();
            expect(replay.responder({ kind: "http", method: "post", options: { url: "/sdk", body: "<RetrieveServiceContent/>" } })).toEqual(["a"]);
        });

        it("matches the http protocol when the fixture names it, defaulting to http", () => {
            const replay = createReplay([{ kind: "http", method: "get", target: "/", protocol: "https", reply: ["s"] }, { kind: "http", method: "get", target: "/", protocol: "http", reply: ["p"] }]);
            expect(replay.responder({ kind: "http", method: "get", options: { url: "/" } })).toEqual(["p"]);
            expect(replay.responder({ kind: "http", method: "get", options: { url: "/", protocol: "https" } })).toEqual(["s"]);
        });

        it("matches SNMP calls by OID", () => {
            const replay = createReplay([{ kind: "snmp", method: "get", target: "1.2,1.3", reply: [{}, null] }]);
            expect(replay.responder({ kind: "snmp", method: "get", options: ["1.2", "1.3"] })).toEqual([{}, null]);
            expect(replay.problems()).toEqual([]);
        });
    });

    it("fixes the clock and seeds Math.random", () => {
        const a = deterministicGlobals();
        const b = deterministicGlobals();
        expect(new a.Date().getTime()).toBe(FIXED_NOW);
        expect(a.Date.now()).toBe(FIXED_NOW);
        expect(new a.Date(0).getTime()).toBe(0);
        expect(new a.Date() instanceof a.Date).toBe(true);
        expect(a.Math.random()).toBe(b.Math.random());
        expect(a.Math.max(1, 2)).toBe(2);
    });
});
