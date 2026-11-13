var harnessLib = require("./helpers/mock-d");

// WinRM exemplar: winrm/windows_cpu_usage.js
// Transport: D.device.sendWinRMCommand(config, function (output) {...})
// The driver picks its handler from D.getParameter('protocol') at load time,
// so the harness must supply that parameter.

function winrmHarness(extra) {
    var options = { parameters: { protocol: "winrm" } };
    if (extra) {
        Object.keys(extra).forEach(function (k) { options[k] = extra[k]; });
    }
    return harnessLib.createMockD(options);
}

describe("winrm/windows_cpu_usage driver", function () {
    describe("parseOutput()", function () {
        it("should read the third stdout line as the CPU value and report it", async function () {
            var harness = winrmHarness();
            var driver = harnessLib.loadDriver("winrm/windows_cpu_usage.js", harness);

            driver.parseOutput(["Average", "-------", "  5 "]);
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
            var variable = harness.calls.createVariable[0];
            expect(variable.uid).toEqual("cpu-load-average");
            expect(variable.value).toEqual("5"); // spaces stripped
            expect(variable.unit).toEqual("%");
            expect(variable.valueType).toEqual("NUMBER");
        });
    });

    describe("get_status() full procedure (WinRM)", function () {
        it("should execute the command and report the CPU load average", async function () {
            var harness = winrmHarness({
                winrm: function () {
                    return { outcome: { stdout: "Average\n-------\n5\n" } };
                }
            });
            var driver = harnessLib.loadDriver("winrm/windows_cpu_usage.js", harness);

            driver.get_status();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
            expect(harness.calls.createVariable[0].value).toEqual("5");
        });
    });

    describe("validate() (WinRM)", function () {
        it("should succeed when the command returns stdout", async function () {
            var harness = winrmHarness({
                winrm: function () {
                    return { outcome: { stdout: "Average\n-------\n5\n" } };
                }
            });
            var driver = harnessLib.loadDriver("winrm/windows_cpu_usage.js", harness);

            driver.validate();
            var outcome = await harness.completion;

            expect(outcome.type).toBe("success");
        });
    });
});
