var harnessLib = require("./helpers/mock-d");

// winrm/windows_gpo_version.js (BT-7136).
//
// On a domain controller that is NOT the PDC emulator, reached over WinRM with NTLM, Get-GPO without -Server talks
// to the PDC emulator; the DC cannot forward NTLM credentials (double hop), so the call fails with 0x80072020.
// The script reads each GPO unpinned first (as 1.0.3 did); only that error switches it to the host's own name
// (-Server) for the failed GPO and the remaining ones, and the driver logs the switch.
// PowerShell does not run here: the fake device replays what the script prints, and the PowerShell-side fallback
// is covered by the command checks at the bottom (and was run under pwsh with a stubbed Get-GPO, BT-7136 evidence).
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

function scriptResult(gpos, errors, fallback) {
    return outcome(JSON.stringify({ gpos: gpos, errors: errors || [], fallback: fallback || null }) + "\r\n");
}

// What the script prints once the unpinned call failed with 0x80072020 and it switched to this DC.
var READ_ON_DC02 = { server: "DC02", reason: OPERATIONS_ERROR };

// Both GPOs read with the unpinned call (PDC emulator, member server, Basic authentication).
function bothGposRead() {
    return scriptResult([DDP, DDCP]);
}

// Both GPOs read on a DC that is not the PDC emulator, after the switch to the DC itself.
function bothGposReadOnThisDc() {
    return scriptResult([DDP, DDCP], [], READ_ON_DC02);
}

// The error the script reports for a GPO not read on this DC: with the unpinned error when that call was made,
// without it for the GPOs read after the switch.
function notReadOnThisDc(name, unpinned, pinned) {
    return name + ": " + (unpinned ? unpinned + " " : "") + "(on DC02: " + pinned + ")";
}

function infoLog(harness) {
    return harness.calls.console
        .filter(function (c) { return c.level === "info"; })
        .map(function (c) { return c.args.join(" "); })
        .join("\n");
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

        it("logs nothing about a fallback when the unpinned call worked", async function () {
            var r = await run("get_status", bothGposRead);

            expect(infoLog(r.harness)).toBe("");
        });
    });

    describe("when the GPOs were read on the DC itself (not the PDC emulator, 0x80072020)", function () {
        it("get_status lists both GPOs and logs where they were read and why", async function () {
            var r = await run("get_status", bothGposReadOnThisDc);

            expect(r.result.type).toBe("success");
            expect(table(r.harness).records.map(function (x) { return x.id; }))
                .toEqual(["Default Domain Policy", "Default Domain Controllers Policy"]);
            expect(infoLog(r.harness)).toContain("GPOs read on DC02 (-Server)");
            expect(infoLog(r.harness)).toContain("0x80072020");
            expect(errorLog(r.harness)).toBe("");
        });

        it("validate succeeds", async function () {
            var r = await run("validate", bothGposReadOnThisDc);

            expect(r.result.type).toBe("success");
        });
    });

    describe("when some GPOs cannot be read", function () {
        it("get_status still lists the readable GPO and logs the missing one", async function () {
            var r = await run("get_status", function () {
                return scriptResult([DDP], ["Default Domain Controllers Policy: " + NOT_FOUND]);
            });

            expect(r.result.type).toBe("success");
            expect(table(r.harness).records.map(function (x) { return x.id; })).toEqual(["Default Domain Policy"]);
            expect(errorLog(r.harness)).toContain(NOT_FOUND);
        });
    });

    describe("when no GPO can be read", function () {
        function everyGetGpoFails() {
            return scriptResult([], [
                notReadOnThisDc("Default Domain Policy", OPERATIONS_ERROR, ACCESS_DENIED),
                notReadOnThisDc("Default Domain Controllers Policy", null, ACCESS_DENIED)
            ], READ_ON_DC02);
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
            expect(command).toContain("){$g=$null;$e=$null;if(-not $pin){try{$g=Get-GPO -Name $p -ErrorAction Stop}catch{");
        });

        it("switches to the host's DNS host name only on the double-hop error 0x80072020", async function () {
            var command = await commandOf("get_status");

            expect(command.indexOf("$h=[System.Net.Dns]::GetHostName();")).toBe(0);
            expect(command).toContain("catch{$e=$_.Exception.Message;" +
                "if($_.Exception.HResult -eq -2147016672 -or $e -match '0x80072020'){$pin=@{server=$h;reason=$e}}}}");
            expect(0x80072020 | 0).toBe(-2147016672);
        });

        it("retries that GPO on the host and reads the remaining ones there directly", async function () {
            var command = await commandOf("get_status");

            expect(command).toContain("if($pin -and -not $g){try{$g=Get-GPO -Name $p -Server $h -ErrorAction Stop}");
        });

        it("reports a GPO not read with every error it got, and prints the fallback", async function () {
            var command = await commandOf("get_status");

            expect(command).toContain("catch{$m='(on '+$h+': '+$_.Exception.Message+')';if($e){$e+=' '+$m}else{$e=$m}}};");
            expect(command).toContain("else{$errs+=$p+': '+$e}};");
            expect(command).toContain("@{gpos=$gpos;errors=$errs;fallback=$pin}");
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
