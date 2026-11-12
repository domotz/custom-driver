/**
 * Generated robustness net: every catalogue driver x entry point x hostile scenario.
 * NET_DRIVER=<substring> limits the run to drivers whose path contains it.
 */
const path = require("path");
const { discoverDrivers, parametersFor } = require("./net/catalogue");
const { SCENARIOS } = require("./net/scenarios");
const { runEntryPoint, verdict } = require("./net/run-driver");

const TIME_LIMIT_MS = 2000;
const filter = process.env.NET_DRIVER || "";
const drivers = discoverDrivers(path.join(__dirname, "..")).filter((d) => d.path.includes(filter));

describe("robustness net", () => {
    beforeAll(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = TIME_LIMIT_MS * 3;
    });

    drivers.forEach((driver) => {
        describe(driver.path, () => {
            driver.entryPoints.forEach((entryPoint) => {
                describe(entryPoint, () => {
                    SCENARIOS.forEach((scenario) => {
                        it("survives " + scenario.id, async () => {
                            const result = await runEntryPoint({
                                source: driver.source,
                                filename: driver.file,
                                entryPoint,
                                responder: scenario.responder,
                                parameters: parametersFor(driver),
                                driverType: driver.driverType,
                                timeLimitMs: TIME_LIMIT_MS
                            });
                            const v = verdict(result);
                            expect(v.pass).withContext(v.reason).toBe(true);
                        });
                    });
                });
            });
        });
    });
});
