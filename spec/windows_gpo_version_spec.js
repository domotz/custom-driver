var harnessLib = require("./helpers/mock-d");

// winrm/windows_gpo_version.js (BT-7136).
//
// On a domain controller that is NOT the PDC emulator, reached over WinRM with NTLM, Get-GPO without -Server talks
// to the PDC emulator; the DC cannot forward NTLM credentials (double hop), so the call fails with 0x80072020.
// The script reads each GPO unpinned first (as 1.0.3 did) and retries it pinned to the host only when that fails.
// PowerShell does not run here: the fake device replays what the script prints, and the PowerShell-side fallback
// is covered by the command checks at the bottom.
//
// Error strings follow remote_pawn_ng: commands/device/winrm/cli.js hands the driver JSON.stringify(err), where err
// is the Go client's error ({code: "EWINRM_AUTH", kind, httpStatus}, winrm/go/runner.js) or the legacy client's
// ({code: 401}, winrm/legacy/client.js); Error.message is not enumerable, so it is not in the string.

var DDP = { Name: "Default Domain Policy", Status: "AllSettingsEnabled", UADVersion: 0, USVVersion: 0, CADVersion: 14, CSVVersion: 14 };
var DDCP = { Name: "Default Domain Controllers Policy", Status: "UserSettingsDisabled", UADVersion: 3, USVVersion: 3, CADVersion: 9, CSVVersion: 8 };
var OPERATIONS_ERROR = "An operations error occurred. (Exception from HRESULT: 0x80072020)";
var NOT_FOUND = "GPO with name Default Domain Controllers Policy was not found in the contoso.local domain.";
var ACCESS_DENIED = "Access is denied. (Exception from HRESULT: 0x80070005 (E_ACCESSDENIED))";

function outcome(stdout, stderr) {
    return { outcome: { exitCode: 0, stdout: stdout, stderr: stderr || "", durationMs: 120 }, error: null };
}

function winrmError(fields) {
    return { outcome: null, error: JSON.stringify(fields) };
}

function scriptResult(gpos, errors) {
    return outcome(JSON.stringify({ gpos: gpos, errors: errors || [] }) + "\r\n");
}

// Both GPOs read (on a DC that is not the PDC emulator: by the pinned retry).
function bothGposRead() {
    return scriptResult([DDP, DDCP]);
}

// The error the script reports when the unpinned call and the pinned retry both fail.
function bothCallsFailed(name, unpinned, pinned) {
    return name + ": " + unpinned + " (on DC02: " + pinned + ")";
}

function run(entryPoint, responder) {
    var commands = [];
    var harness = harnessLib.createMockD({
        winrm: function (config) {
            commands.push(config.command);
            return responder(config.command);
        }
    });
    var driver = harnessLib.loadDriver("winrm/windows_gpo_version.js", harness);
    try {
        driver[entryPoint]();
    } catch (e) {
        // The mock transport calls back synchronously: a throw in the callback is a sandbox crash on the collector.
        return Promise.resolve({ result: { type: "crash", error: String(e) }, harness: harness, commands: commands });
    }
    return harness.completion.then(function (result) {
        return { result: result, harness: harness, commands: commands };
    });
}

function table(harness) {
    return harness.calls.tables[0];
}

function errorLog(harness) {
    return harness.calls.console
        .filter(function (c) { return c.level === "error"; })
        .map(function (c) { return c.args.join(" "); })
        .join("\n");
}

describe("winrm/windows_gpo_version driver (BT-7136)", function () {
    describe("when both GPOs are read", function () {
        it("get_status lists both GPOs", async function () {
            var r = await run("get_status", bothGposRead);

            expect(r.result.type).toBe("success");
            expect(table(r.harness).id).toBe("Group Policy Objects");
            expect(table(r.harness).records.map(function (x) { return x.id; }))
                .toEqual(["Default Domain Policy", "Default Domain Controllers Policy"]);
            expect(table(r.harness).records[1].values).toEqual(["UserSettingsDisabled", 3, 3, 9, 8]);
        });

        it("validate succeeds", async function () {
            var r = await run("validate", bothGposRead);

            expect(r.result.type).toBe("success");
        });
    });

    describe("when some GPOs cannot be read", function () {
        it("get_status still lists the readable GPO and logs the missing one", async function () {
            var r = await run("get_status", function () {
                return scriptResult([DDP], [bothCallsFailed("Default Domain Controllers Policy", NOT_FOUND, NOT_FOUND)]);
            });

            expect(r.result.type).toBe("success");
            expect(table(r.harness).records.map(function (x) { return x.id; })).toEqual(["Default Domain Policy"]);
            expect(errorLog(r.harness)).toContain(NOT_FOUND);
        });
    });

    describe("when no GPO can be read", function () {
        function everyGetGpoFails() {
            return scriptResult([], [
                bothCallsFailed("Default Domain Policy", OPERATIONS_ERROR, ACCESS_DENIED),
                bothCallsFailed("Default Domain Controllers Policy", OPERATIONS_ERROR, ACCESS_DENIED)
            ]);
        }

        it("get_status fails and logs the PowerShell error", async function () {
            var r = await run("get_status", everyGetGpoFails);

            expect(r.result).toEqual({ type: "failure", errorType: "GENERIC_ERROR" });
            expect(r.harness.calls.failure.length).toBe(1);
            expect(errorLog(r.harness)).toContain("0x80072020");
            expect(errorLog(r.harness)).toContain("0x80070005");
        });

        it("validate fails and logs the PowerShell error", async function () {
            var r = await run("validate", everyGetGpoFails);

            expect(r.result).toEqual({ type: "failure", errorType: "GENERIC_ERROR" });
            expect(errorLog(r.harness)).toContain("0x80072020");
        });
    });

    describe("output shapes", function () {
        it("reads a single GPO serialized as a bare object", async function () {
            var r = await run("get_status", function () {
                return outcome(JSON.stringify({ gpos: DDP, errors: [] }));
            });

            expect(r.result.type).toBe("success");
            expect(table(r.harness).records.map(function (x) { return x.id; })).toEqual(["Default Domain Policy"]);
        });

        it("reads the PowerShell 5.1 {value, Count} array wrapper", async function () {
            var r = await run("get_status", function () {
                return outcome(JSON.stringify({ gpos: { value: [DDP, DDCP], Count: 2 }, errors: [] }));
            });

            expect(r.result.type).toBe("success");
            expect(table(r.harness).records.length).toBe(2);
        });

        it("skips a row without a name", async function () {
            var r = await run("get_status", function () {
                return scriptResult([DDP, { Status: "AllSettingsEnabled" }]);
            });

            expect(r.result.type).toBe("success");
            expect(table(r.harness).records.map(function (x) { return x.id; })).toEqual(["Default Domain Policy"]);
        });

        it("reads the JSON after a WARNING line on stdout", async function () {
            var r = await run("get_status", function () {
                return outcome("WARNING: The names of some imported commands include unapproved verbs.\r\n" +
                    JSON.stringify({ gpos: [DDP, DDCP], errors: [] }) + "\r\n");
            });

            expect(r.result.type).toBe("success");
            expect(table(r.harness).records.length).toBe(2);
        });

        it("reports a parsing error on empty output", async function () {
            var r = await run("get_status", function () { return outcome(""); });

            expect(r.result).toEqual({ type: "failure", errorType: "PARSING_ERROR" });
        });
    });

    describe("WinRM errors (a JSON string, as the collector hands them over)", function () {
        var cases = [
            { name: "Go client 401", error: { code: "EWINRM_AUTH", kind: "auth", httpStatus: 401 }, expected: "AUTHENTICATION_ERROR" },
            { name: "legacy client 401", error: { code: 401 }, expected: "AUTHENTICATION_ERROR" },
            { name: "Go client 404", error: { code: "EWINRM_SOAP_FAULT", kind: "soap", httpStatus: 404 }, expected: "RESOURCE_UNAVAILABLE" },
            { name: "legacy client 404", error: { code: 404 }, expected: "RESOURCE_UNAVAILABLE" },
            { name: "network error", error: { code: "EWINRM_NETWORK", kind: "network" }, expected: "GENERIC_ERROR" }
        ];

        cases.forEach(function (c) {
            ["validate", "get_status"].forEach(function (entryPoint) {
                it(entryPoint + ": " + c.name + " reports " + c.expected + " once", async function () {
                    var r = await run(entryPoint, function () { return winrmError(c.error); });

                    expect(r.result).toEqual({ type: "failure", errorType: c.expected });
                    expect(r.harness.calls.failure.length).toBe(1);
                });
            });
        });

        it("reports GENERIC_ERROR for a plain-text error", async function () {
            var r = await run("get_status", function () { return { outcome: null, error: "broker closed" }; });

            expect(r.result).toEqual({ type: "failure", errorType: "GENERIC_ERROR" });
            expect(errorLog(r.harness)).toContain("broker closed");
        });
    });

    describe("the PowerShell command", function () {
        async function commandOf(entryPoint) {
            var r = await run(entryPoint, bothGposRead);
            return r.commands[0];
        }

        it("reads each GPO unpinned first, the call 1.0.3 made", async function () {
            var command = await commandOf("get_status");
            var getGpoCalls = command.match(/Get-GPO [^;}]*/g);

            expect(getGpoCalls.length).toBe(2);
            expect(getGpoCalls[0]).toBe("Get-GPO -Name $p -ErrorAction Stop");
            expect(command).toContain("){$g=$null;try{$g=Get-GPO -Name $p -ErrorAction Stop}catch{");
        });

        it("retries a GPO pinned to the host's DNS host name only when the unpinned call fails", async function () {
            var command = await commandOf("get_status");

            expect(command.indexOf("$h=[System.Net.Dns]::GetHostName();")).toBe(0);
            expect(command).toContain("catch{$e=$_.Exception.Message;try{$g=Get-GPO -Name $p -Server $h -ErrorAction Stop}");
        });

        it("reports both errors when the pinned retry fails too, and keeps only GPOs read", async function () {
            var command = await commandOf("get_status");

            expect(command).toContain("catch{$errs+=$p+': '+$e+' (on '+$h+': '+$_.Exception.Message+')'}};if($g){$gpos+=");
        });

        it("does not depend on WMI (no host role lookup before Get-GPO)", async function () {
            var command = await commandOf("get_status");

            expect(command).not.toMatch(/Get-CimInstance|Get-WmiObject|DomainRole/);
        });

        it("quotes GPO names for PowerShell, typographic apostrophes included", function () {
            var driver = harnessLib.loadDriver("winrm/windows_gpo_version.js", harnessLib.createMockD({}));

            expect(driver.psQuote("O'Brien Policy")).toBe("'O''Brien Policy'");
            expect(driver.psQuote("Users’ Drive Mappings")).toBe("'Users’’ Drive Mappings'");
            expect(driver.psQuote("‘Kiosk‛")).toBe("'‘‘Kiosk‛‛'");
        });

        it("is the same script for validate and get_status", async function () {
            expect(await commandOf("validate")).toEqual(await commandOf("get_status"));
        });

        it("has no double quote, so cmd.exe keeps it inside the collector's powershell.exe \"...\" wrapper", async function () {
            expect(await commandOf("get_status")).not.toContain("\"");
        });
    });
});
