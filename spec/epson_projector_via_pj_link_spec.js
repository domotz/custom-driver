var EventEmitter = require("events");
var harnessLib = require("./helpers/mock-d");

// Raw-socket exemplar: telnet/epson_projector_via_pj_link.js
// executeCommand() drives a net.Socket; a fake EventEmitter stands in for it.

function fakeClient() {
    var client = new EventEmitter();
    client.written = [];
    client.ended = false;
    client.setTimeout = function () {};
    client.write = function (data) {
        client.written.push(data);
    };
    client.end = function () {
        client.ended = true;
    };
    return client;
}

describe("telnet/epson_projector_via_pj_link driver", function () {
    var driver;
    var client;
    beforeEach(function () {
        driver = harnessLib.loadDriver("telnet/epson_projector_via_pj_link.js", harnessLib.createMockD());
        client = fakeClient();
    });

    it("sends the command after an unauthenticated greeting and resolves the lamp hours", function (done) {
        driver.executeCommand(client, "%1LAMP ?\r").then(function (variables) {
            expect(client.written).toEqual(["%1LAMP ?\r"]);
            expect(variables.map(function (v) { return v.value; })).toEqual(["Power On", "1200"]);
            done();
        });
        client.emit("data", "PJLINK 0\r");
        client.emit("data", "%1LAMP=1200 1\r");
    });

    it("rejects when the projector never answers", function (done) {
        driver.executeCommand(client, "%1LAMP ?\r").catch(function (error) {
            expect(error).toEqual("Socket timeout without a valid response");
            expect(client.ended).toBeTrue();
            done();
        });
        client.emit("timeout");
    });

    it("rejects a PJLINK 1 greeting whose seed is not 8 characters", function (done) {
        driver.executeCommand(client, "%1LAMP ?\r").catch(function (error) {
            expect(error).toEqual("Unsupported PJLINK greeting: 1 abc");
            expect(client.written).toEqual([]);
            done();
        });
        client.emit("data", "PJLINK 1 abc\r");
    });
});
