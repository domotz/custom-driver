/**
 * Golden success-path specs: each driver with a fixture under spec/golden/fixtures/ runs every entry
 * point against recorded device replies (the robustness net's production-style runner, with a fixed
 * clock) and must
 *   1. pass the net's verdict (no crash, no unhandled rejection, reports),
 *   2. make exactly the fixture's transport calls,
 *   3. report one D.success that production would accept and that matches the companion
 *      expected_variables (golden/success-check.js),
 *   4. report the same thing as its snapshot under spec/golden/snapshots/.
 * UPDATE_GOLDEN=1 rewrites the snapshots instead of comparing; review the diff before committing.
 * GOLDEN_DRIVER=<substring> limits the run to fixtures whose driver path contains it.
 */
const fs = require("fs");
const path = require("path");
const { discoverDrivers } = require("./net/catalogue");
const { runEntryPoint, verdict } = require("./net/run-driver");
const { createReplay } = require("./golden/replay");
const { checkSuccess, normalizeReport } = require("./golden/success-check");
const { deterministicGlobals } = require("./golden/clock");

process.env.TZ = "UTC";

const TIME_LIMIT_MS = 2000;
const EXAMPLES = path.join(__dirname, "..");
const FIXTURES = path.join(__dirname, "golden", "fixtures");
const SNAPSHOTS = path.join(__dirname, "golden", "snapshots");
const update = process.env.UPDATE_GOLDEN === "1";
const filter = process.env.GOLDEN_DRIVER || "";

function listFixtures() {
    return fs.readdirSync(FIXTURES, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .flatMap((d) => fs.readdirSync(path.join(FIXTURES, d.name))
            .filter((f) => f.endsWith(".js"))
            .map((f) => d.name + "/" + f))
        .sort();
}

const drivers = new Map(discoverDrivers(EXAMPLES).map((d) => [d.path, d]));

function readJson(file) {
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null;
}

// JSON round trip, so the snapshot comparison sees what the file stores (no undefined members).
const plain = (value) => JSON.parse(JSON.stringify(value === undefined ? null : value));

describe("golden success paths", () => {
    beforeAll(() => {
        jasmine.DEFAULT_TIMEOUT_INTERVAL = TIME_LIMIT_MS * 3;
    });

    listFixtures().filter((f) => f.includes(filter)).forEach((fixtureFile) => {
        const driverPath = fixtureFile;
        const fixture = require(path.join(FIXTURES, fixtureFile));
        const driver = drivers.get(driverPath);
        const companion = readJson(path.join(EXAMPLES, driverPath.replace(/\.js$/, ".json")));
        const snapshotFile = path.join(SNAPSHOTS, driverPath.replace(/\.js$/, ".json"));
        const recorded = {};

        describe(driverPath, () => {
            const snapshot = readJson(snapshotFile) || {};

            it("has a catalogue driver and a fixture for every entry point", () => {
                expect(driver).withContext("no catalogue driver at " + driverPath).toBeDefined();
                const skipped = Object.keys(fixture.skipEntryPoints || {});
                fixture.cases.forEach((c) => {
                    const missing = driver.entryPoints.filter((ep) => !(ep in c.entryPoints) && !skipped.includes(ep));
                    expect(missing).withContext("case " + c.name + " has no fixture for these entry points").toEqual([]);
                });
            });

            fixture.cases.forEach((c) => {
                Object.keys(c.entryPoints).forEach((entryPoint) => {
                    const spec = c.entryPoints[entryPoint];
                    const key = c.name + " " + entryPoint;

                    it(key + " succeeds as recorded", async () => {
                        const replay = createReplay(spec.calls);
                        const result = await runEntryPoint({
                            source: driver.source,
                            filename: driver.file,
                            entryPoint,
                            responder: replay.responder,
                            parameters: c.parameters || {},
                            driverType: driver.driverType,
                            globals: deterministicGlobals(),
                            timeLimitMs: TIME_LIMIT_MS
                        });
                        const v = verdict(result);
                        expect(v.pass).withContext(v.reason).toBe(true);
                        expect(replay.problems()).withContext("transport calls").toEqual([]);
                        const problems = checkSuccess(result, { entryPoint, companion, expect: spec.expect });
                        expect(problems).withContext("success check").toEqual([]);

                        const actual = plain(normalizeReport(result.firstReport));
                        if (update) {
                            // Only a run that passed every check above becomes the expected output.
                            if (v.pass && replay.problems().length === 0 && problems.length === 0) {
                                recorded[key] = actual;
                            }
                        } else if (!(key in snapshot)) {
                            fail("no snapshot for " + JSON.stringify(key) + "; run UPDATE_GOLDEN=1 and review it");
                        } else {
                            expect(actual).withContext("snapshot " + path.relative(EXAMPLES, snapshotFile)).toEqual(snapshot[key]);
                        }
                    });
                });
            });

            if (update) {
                afterAll(() => {
                    fs.mkdirSync(path.dirname(snapshotFile), { recursive: true });
                    fs.writeFileSync(snapshotFile, JSON.stringify(recorded, null, 4) + "\n");
                });
            }
        });
    });
});
