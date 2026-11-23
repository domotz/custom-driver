var harnessLib = require("./helpers/mock-d");

// winrm/windows_cpu_memory.js and its HTTPS twin.
// Win32_processor returns one object per physical socket: ConvertTo-Json gives a bare object on a
// single-socket host and an array on a multi-socket one. The CPU variables must describe the machine.

var DRIVERS = ["winrm/windows_cpu_memory.js", "winrm/windows_cpu_memory_https.js"];

var XEON = "Intel(R) Xeon(R) Gold 6226R CPU @ 2.90GHz";

function socket(overrides) {
    var cpu = { name: XEON, MaxClockSpeed: 2900, NumberOfLogicalProcessors: 32, NumberOfCores: 16, Status: "OK" };
    Object.keys(overrides || {}).forEach(function (k) { cpu[k] = overrides[k]; });
    return cpu;
}

function payload(cpuInfo) {
    return { CPUInfo: cpuInfo, TotalMemory: 137438953472, AvailableMemory: 67108864, Average: 7.5 };
}

function winrmHarness(extra) {
    var options = { parameters: { protocol: "winrm" } };
    Object.keys(extra || {}).forEach(function (k) { options[k] = extra[k]; });
    return harnessLib.createMockD(options);
}

function valuesByUid(harness) {
    var values = {};
    harness.calls.createVariable.forEach(function (v) { values[v.uid] = v.value; });
    return values;
}

async function parse(driverPath, cpuInfo) {
    var harness = winrmHarness();
    var driver = harnessLib.loadDriver(driverPath, harness);
    driver.parseOutput(payload(cpuInfo));
    var outcome = await harness.completion;
    expect(outcome.type).toBe("success");
    expect(harness.calls.createVariable.length).toBe(9);
    return valuesByUid(harness);
}

DRIVERS.forEach(function (driverPath) {
    describe(driverPath + " driver", function () {
        describe("parseOutput() CPU variables", function () {
            it("reports the whole machine when Win32_processor returns one object per socket", async function () {
                var values = await parse(driverPath, [socket(), socket()]);

                expect(values["cpu-name"]).toEqual(XEON);
                expect(values["max-clock-speed"]).toEqual(2.9);
                expect(values["logical-processors-number"]).toEqual(64);
                expect(values["cores-number"]).toEqual(32);
                expect(values["cpu-status"]).toEqual("OK");
            });

            it("shows a socket that is not OK instead of hiding it behind the first one", async function () {
                var values = await parse(driverPath, [socket(), socket({ Status: "Degraded" })]);

                expect(values["cpu-status"]).toEqual("OK, Degraded");
            });

            it("lists each distinct model and takes the highest clock speed on mixed sockets", async function () {
                var values = await parse(driverPath, [
                    socket(),
                    socket({ name: "Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz", MaxClockSpeed: 3000, NumberOfLogicalProcessors: 48, NumberOfCores: 24 })
                ]);

                expect(values["cpu-name"]).toEqual(XEON + ", Intel(R) Xeon(R) Gold 6248R CPU @ 3.00GHz");
                expect(values["max-clock-speed"]).toEqual(3);
                expect(values["logical-processors-number"]).toEqual(80);
                expect(values["cores-number"]).toEqual(40);
            });

            it("keeps the single-socket values when CPUInfo is a bare object", async function () {
                var values = await parse(driverPath, socket({ name: "12th Gen Intel(R) Core(TM) i7-1255U", MaxClockSpeed: 1700, NumberOfLogicalProcessors: 12, NumberOfCores: 10 }));

                expect(values["cpu-name"]).toEqual("12th Gen Intel(R) Core(TM) i7-1255U");
                expect(values["max-clock-speed"]).toEqual(1.7);
                expect(values["logical-processors-number"]).toEqual(12);
                expect(values["cores-number"]).toEqual(10);
                expect(values["cpu-status"]).toEqual("OK");
            });

            it("leaves the memory variables untouched", async function () {
                var values = await parse(driverPath, [socket(), socket()]);

                expect(values["total-memory"]).toEqual(128);
                expect(values["available-memory"]).toEqual("64.00");
                expect(values["memory-usage"]).toEqual("50.00");
                expect(values["cpu-average"]).toEqual("7.50");
            });
        });

        describe("get_status() full procedure (WinRM)", function () {
            it("reports a two-socket server from the command's JSON", async function () {
                var harness = winrmHarness({
                    winrm: function () {
                        return { outcome: { stdout: JSON.stringify(payload([socket(), socket()])) + "\r\n" } };
                    }
                });
                var driver = harnessLib.loadDriver(driverPath, harness);

                driver.get_status();
                var outcome = await harness.completion;

                expect(outcome.type).toBe("success");
                var values = valuesByUid(harness);
                expect(values["cores-number"]).toEqual(32);
                expect(values["logical-processors-number"]).toEqual(64);
                expect(values["cpu-name"]).toEqual(XEON);
            });
        });
    });
});
