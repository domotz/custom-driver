const { createFakeD } = require("./fake-d");

describe("strict fake D", () => {
    const tick = () => new Promise((resolve) => setImmediate(resolve));

    it("delivers http.get callbacks asynchronously with the responder's args", async () => {
        const calls = [];
        const { D, record } = createFakeD({
            responder: (call) => {
                calls.push(call);
                return [null, { statusCode: 200 }, "ok"];
            }
        });
        let received = null;
        D.device.http.get({ url: "/x" }, (...args) => {
            received = args;
        });
        expect(received).toBeNull();
        await tick();
        expect(received).toEqual([null, { statusCode: 200 }, "ok"]);
        expect(calls[0]).toEqual({ kind: "http", method: "get", options: { url: "/x" } });
        expect(record.transportCalls).toBe(1);
    });

    it("records a throw in a wrapped callback as a GENERIC_ERROR failure", async () => {
        const { D, record } = createFakeD({ responder: () => [null, {}, ""] });
        D.device.http.get({}, () => {
            throw new Error("boom");
        });
        await tick();
        expect(record.reports[0]).toEqual(jasmine.objectContaining({ type: "failure", errorType: "GENERIC_ERROR" }));
        expect(record.wrappedThrows.length).toBe(1);
        expect(record.crashes.length).toBe(0);
    });

    it("records a throw in an unwrapped callback as a crash", async () => {
        const { D, record } = createFakeD({ responder: () => [{ outcome: null, error: "x" }] });
        D.device.sendWinRMCommand({}, () => {
            throw new Error("boom");
        });
        await tick();
        expect(record.crashes.length).toBe(1);
        expect(record.crashes[0].where).toBe("sendWinRMCommand");
        expect(record.wrappedThrows.length).toBe(0);
    });

    it("first report wins", () => {
        const { D, record } = createFakeD({ responder: () => [] });
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        D.success();
        expect(record.firstReport.errorType).toBe("AUTHENTICATION_ERROR");
        expect(record.reports.length).toBe(2);
    });

    it("counts D.failure(undefined) as GENERIC_ERROR and keeps the original", () => {
        const { D, record } = createFakeD({ responder: () => [] });
        D.failure(undefined);
        expect(record.firstReport.errorType).toBe("GENERIC_ERROR");
        expect(record.firstReport.originalErrorType).toBeUndefined();
    });

    it("throws on an unknown D member", () => {
        const { D, record } = createFakeD({ responder: () => [] });
        expect(() => D.nope).toThrowError(/fake D has no member D.nope/);
        expect(() => D.device.nope).toThrowError(/fake D has no member D.device.nope/);
        expect(() => D.q).toThrowError(/fake D has no member D.q/);
        expect(record.unknownMembers).toEqual(["D.nope", "D.device.nope", "D.q"]);
    });

    it("does not trip on symbols or then", async () => {
        const { D, record } = createFakeD({ responder: () => [] });
        expect(D.then).toBeUndefined();
        expect(D[Symbol.toPrimitive]).toBeUndefined();
        expect((await D) === D).toBe(true);
        expect(record.unknownMembers).toEqual([]);
    });

    it("supports typeof feature checks on real members", () => {
        const { D } = createFakeD({ responder: () => [] });
        expect(typeof D.createBackup).toBe("function");
        expect(typeof D._.isArray).toBe("function");
    });

    it("getParameter returns the provided parameters", () => {
        const { D } = createFakeD({ responder: () => [], parameters: { port: 22 } });
        expect(D.getParameter("port")).toBe(22);
        expect(D.getParameter("other")).toBeNull();
    });

    it("createExternalDevice exposes the same transports", async () => {
        const calls = [];
        const { D } = createFakeD({
            responder: (call) => {
                calls.push(call);
                return [null, {}, ""];
            }
        });
        D.createExternalDevice("h").http.get({}, () => {});
        await tick();
        expect(calls[0].kind).toBe("http");
    });

    it("routes SNMP sessions and delivers (output, error)", async () => {
        const { D, record } = createFakeD({ responder: () => [{ "1.2": "v" }, null] });
        const session = D.device.createSNMPSession({ community: "c" });
        expect(() => session.nope).toThrowError(/fake D has no member/);
        let got;
        session.get(["1.2"], (...args) => {
            got = args;
        });
        await tick();
        expect(got).toEqual([{ "1.2": "v" }, null]);
        expect(record.transportCalls).toBe(1);
    });

    it("uses the supplied schedule for delivery", () => {
        const queue = [];
        const { D } = createFakeD({ responder: () => ["out", null], schedule: (fn) => queue.push(fn) });
        let got;
        D.device.sendSSHCommand({}, (...a) => {
            got = a;
        });
        expect(queue.length).toBe(1);
        queue[0]();
        expect(got).toEqual(["out", null]);
    });

    it("hashes like production crypto", () => {
        const { D } = createFakeD({ responder: () => [] });
        expect(D.crypto.hash("a", "md5", "utf8", "hex")).toBe("0cc175b9c0f1b6a831c399e269772661");
        expect(() => D.crypto.nope).toThrowError(/D.crypto.nope/);
    });

    it("tolerates serialisation and pretty-printing reads", () => {
        const { D, record } = createFakeD({ responder: () => [] });
        expect(() => JSON.stringify(D.device)).not.toThrow();
        expect(() => JSON.stringify(D)).not.toThrow();
        expect(typeof jasmine.makePrettyPrinter()(D)).toBe("string");
        expect(record.unknownMembers).toEqual([]);
    });

    describe("callback rows", () => {
        const rows = [
            ["http.get", true, (D, cb) => D.device.http.get({}, cb), "http.get"],
            ["http.post", true, (D, cb) => D.device.http.post({}, cb), "http.post"],
            ["http.put", true, (D, cb) => D.device.http.put({}, cb), "http.put"],
            ["http.delete", true, (D, cb) => D.device.http.delete({}, cb), "http.delete"],
            ["sendSSHCommand", true, (D, cb) => D.device.sendSSHCommand({}, cb), "sendSSHCommand"],
            ["sendTelnetCommand", true, (D, cb) => D.device.sendTelnetCommand({}, cb), "sendTelnetCommand"],
            ["sendTCPCommand", true, (D, cb) => D.device.sendTCPCommand({}, cb), "sendTCPCommand"],
            ["snmp get", true, (D, cb) => D.device.createSNMPSession({}).get([], cb), "get"],
            ["snmp walk", true, (D, cb) => D.device.createSNMPSession({}).walk("1", cb), "walk"],
            ["snmp getRaw", true, (D, cb) => D.device.createSNMPSession({}).getRaw([], cb), "getRaw"],
            ["snmp set", true, (D, cb) => D.device.createSNMPSession({}).set([], cb), "set"],
            ["getTLSCertificate", false, (D, cb) => D.device.http.getTLSCertificate({}, cb), "getTLSCertificate"],
            ["sendSSHCommands", false, (D, cb) => D.device.sendSSHCommands({}, cb), "sendSSHCommands"],
            ["sendWinRMCommand", false, (D, cb) => D.device.sendWinRMCommand({}, cb), "sendWinRMCommand"],
            ["ping", false, (D, cb) => D.device.ping({}, cb), "ping"],
            ["mtr", false, (D, cb) => D.device.mtr({}, cb), "mtr"],
            ["tftpServer.accept", false, (D, cb) => D.tftpServer.accept({}, cb, () => {}), "tftp.accept"]
        ];
        rows.forEach(([label, wrapped, invoke, where]) => {
            it(label + (wrapped ? " is wrapped" : " is unwrapped"), async () => {
                const { D, record } = createFakeD({ responder: () => [null, null] });
                invoke(D, () => {
                    throw new Error("boom");
                });
                await new Promise((resolve) => setImmediate(resolve));
                if (wrapped) {
                    expect(record.wrappedThrows.length).toBe(1);
                    expect(record.crashes.length).toBe(0);
                    expect(record.reports.length).toBe(1);
                    expect(record.reports[0]).toEqual(jasmine.objectContaining({ type: "failure", errorType: "GENERIC_ERROR" }));
                } else {
                    expect(record.crashes.length).toBe(1);
                    expect(record.crashes[0].where).toBe(where);
                    expect(record.wrappedThrows.length).toBe(0);
                    expect(record.reports.length).toBe(0);
                }
            });
        });
    });

    describe("createTable().insertRecord validates like library/table.js", () => {
        const table = () => createFakeD({ responder: () => [] }).D.createTable("T", [{ label: "A" }, { label: "B" }]);
        const idMessage = "Defined record id must be a string with max length: 50";

        it("accepts a valid record and records it", () => {
            const t = table();
            t.insertRecord("row-1", ["a", 2]);
            t.insertRecord("x".repeat(50), [null, "y".repeat(500)]);
            expect(t.records).toEqual([
                { id: "row-1", values: ["a", 2] },
                { id: "x".repeat(50), values: [null, "y".repeat(500)] }
            ]);
        });

        it("rejects an empty, non-string or over-50-character id", () => {
            expect(() => table().insertRecord("", ["a", "b"])).toThrowError(idMessage);
            expect(() => table().insertRecord(undefined, ["a", "b"])).toThrowError(idMessage);
            expect(() => table().insertRecord(7, ["a", "b"])).toThrowError(idMessage);
            expect(() => table().insertRecord("x".repeat(51), ["a", "b"])).toThrowError(idMessage);
        });

        it("rejects a reserved id", () => {
            for (const id of ["table", "column", "history", "a/table", "history/b"]) {
                expect(() => table().insertRecord(id, ["a", "b"])).toThrowError(`Defined record id '${id}' is a reserved word`);
            }
            expect(() => table().insertRecord("tables", ["a", "b"])).not.toThrow();
        });

        it("rejects a value count different from the column count", () => {
            expect(() => table().insertRecord("r", ["a"]))
                .toThrowError("Defined column header size is different than inserted values size: 2 != 1");
            expect(() => table().insertRecord("r", ["a", "b", "c"]))
                .toThrowError("Defined column header size is different than inserted values size: 2 != 3");
        });

        it("rejects a value over 500 characters", () => {
            expect(() => table().insertRecord("r", ["a", "z".repeat(501)]))
                .toThrowError("Record cannot contain a value that exceeds 500 characters (index: 1)");
        });

        it("rejects a duplicate id", () => {
            const t = table();
            t.insertRecord("r", ["a", "b"]);
            expect(() => t.insertRecord("r", ["c", "d"])).toThrowError("Duplicate record id. Cannot insert record: r");
            expect(t.records.length).toBe(1);
        });
    });
});
