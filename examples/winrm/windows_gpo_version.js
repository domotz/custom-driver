/**
 * Domotz Custom Driver
 * Name: Windows GPOs version
 * Description: monitors the versions of selected GPOs, you can set the initial value as baseline and get alerted if it changes.
 * Run it against a domain controller (writable or read-only) with the GroupPolicy PowerShell module.
 *
 * Communication protocol is WinRM
 *
 * Tested on Windows Versions:
 *      - Microsoft Windows Server 2019
 * Powershell Version:
 *      - 5.1.19041.2364
 *
 * Creates a Custom Driver Table with Policy name, status, User AD and SYSVOL versions, Computer AD and SYSVOL version
 *      Status: The current status of the GPO being monitored (Enabled, Disabled).
 *      AD Version (User): The version of the Active Directory (AD) associated with the user settings of the GPO.
 *      SYSVOL Version (User): The version of the SYSVOL folder associated with the user settings of the GPO.
 *      AD Version (Computer): The version of the Active Directory (AD) associated with the computer settings of the GPO.
 *      SYSVOL Version (Computer): The version of the SYSVOL folder associated with the computer settings of the GPO.
 *
 * Required permissions: AD user
 *
 * Notes:
 *  - Each GPO is read with Get-GPO as before, which contacts the PDC emulator. On a domain controller that is not
 *    the PDC emulator, over WinRM with NTLM, the DC cannot pass the credentials on and that call fails with
 *    "An operations error occurred (0x80072020)": the driver then retries the GPO on this DC itself
 *    (-Server <its own DNS host name>). Wherever the first call works (PDC emulator, member server with the
 *    GroupPolicy module, Basic authentication) nothing changes.
 *  - A GPO that cannot be read is skipped and its PowerShell errors are written to the driver log; the driver fails
 *    only when no GPO can be read.
 *  - Use a username in the DOMAIN\user form: with auth "auto", a username without a backslash (user or
 *    user@domain) makes the collector use Basic authentication, which WinRM usually refuses with 401.
 *
**/

// Define the WinRM options when running the commands
var winrmConfig = {
    "command": "",
    "username": D.device.username(),
    "password": D.device.password(),
    // WinRM transport options:
    port: 5985,                // 5985 = HTTP, 5986 = HTTPS
    scheme: "http",            // "http" | "https"
    skipVerify: true,          // when scheme="https", skip TLS cert verification
    auth: "auto",              // "basic" | "ntlm" | "auto" (inferred from username)
    timeout: 30000               // per-command timeout in milliseconds
};

/**
 * GPO to monitor
 * @var Array gpoNames
 **/
var gpoNames = ["Default Domain Policy", "Default Domain Controllers Policy"];

var gpoTable = D.createTable(
    "Group Policy Objects",
    [
        { label: "Status" },
        { label: "AD Version (User)" },
        { label: "SYSVOL Version (User)" },
        { label: "AD Version (Computer)" },
        { label: "SYSVOL Version (Computer)" }
    ]
);

// A PowerShell single-quoted string literal: PowerShell also ends one on the typographic quotes U+2018-U+201B
function psQuote(value) {
    return "'" + String(value).replace(/['‘-‛]/g, "$&$&") + "'";
}

/**
 * PowerShell that reads each GPO on its own and prints {"gpos": [...], "errors": ["<GPO name>: <error>", ...]}.
 * Each GPO is read first exactly as before (Get-GPO without -Server, which contacts the PDC emulator), so every
 * setup that worked keeps the same call. Only when that call fails is it retried pinned to this host by its DNS
 * host name: on a domain controller that is not the PDC emulator, reached over WinRM with NTLM, the unpinned call
 * fails with 0x80072020 and the pinned one works. When both fail, both errors are reported.
 * The collector runs the command as powershell.exe "<command>", so it uses single quotes only.
 * @param {Array} names The GPO display names
 * @returns {string} The PowerShell command
 */
function buildCommand(names) {
    return "$h=[System.Net.Dns]::GetHostName();$gpos=@();$errs=@();" +
        "foreach($p in @(" + names.map(psQuote).join(",") + ")){$g=$null;" +
        "try{$g=Get-GPO -Name $p -ErrorAction Stop}" +
        "catch{$e=$_.Exception.Message;" +
        "try{$g=Get-GPO -Name $p -Server $h -ErrorAction Stop}" +
        "catch{$errs+=$p+': '+$e+' (on '+$h+': '+$_.Exception.Message+')'}};" +
        "if($g){$gpos+=[PSCustomObject]@{Name=$g.DisplayName;Status=$g.GpoStatus.ToString();" +
        "UADVersion=$g.User.DSVersion;USVVersion=$g.User.SysvolVersion;" +
        "CADVersion=$g.Computer.DSVersion;CSVVersion=$g.Computer.SysvolVersion}}};" +
        "ConvertTo-Json -InputObject @{gpos=$gpos;errors=$errs} -Depth 4 -Compress";
}

/**
 * The collector hands the WinRM error over as a string: the JSON of the client's error
 * ({"code":401} or {"code":"EWINRM_AUTH","kind":"auth","httpStatus":401,...}) or a plain message.
 * @param {*} err The error from the WinRM output
 * @returns {Object} The error fields ({message} for a plain message)
 */
function parseWinRmError(err) {
    if (err && typeof err === "object") {
        return err;
    }
    try {
        var parsed = JSON.parse(err);
        if (parsed && typeof parsed === "object") {
            return parsed;
        }
    } catch (e) {
        // a plain message
    }
    return { message: String(err) };
}

// Check for Errors on the WinRM command response
function checkWinRmError(err) {
    var details = parseWinRmError(err);
    console.error("WinRM error: " + (typeof err === "string" ? err : JSON.stringify(err)));
    if (Number(details.code) === 401 || Number(details.httpStatus) === 401 || details.code === "EWINRM_AUTH" || details.kind === "auth") {
        console.error("401: check that the username includes the domain (DOMAIN\\user) and that WinRM authentication is allowed.");
        D.failure(D.errorType.AUTHENTICATION_ERROR);
        return;
    }
    if (Number(details.code) === 404 || Number(details.httpStatus) === 404) {
        D.failure(D.errorType.RESOURCE_UNAVAILABLE);
        return;
    }
    D.failure(D.errorType.GENERIC_ERROR);
}

/**
 * A list from a JSON value: PowerShell prints one item as a bare object, and PowerShell 5.1 can print an
 * array as {"value": [...], "Count": n}.
 * @param {*} value The parsed JSON value
 * @returns {Array} The items
 */
function asList(value) {
    if (value === null || value === undefined) {
        return [];
    }
    if (Array.isArray(value)) {
        return value;
    }
    if (Array.isArray(value.value)) {
        return value.value;
    }
    return [value];
}

function logStderr(output) {
    var stderr = output.outcome && output.outcome.stderr ? String(output.outcome.stderr).trim() : "";
    if (stderr) {
        console.error("PowerShell error output: " + stderr.slice(0, 1000));
    }
}

/**
 * The script prints its JSON on one line (-Compress), last; powershell.exe can write lines before it on stdout
 * (a "WARNING: ..." from a module load).
 * @param {Object} output The output of the WinRM command
 * @returns {string} The last non-empty line of stdout
 */
function lastStdoutLine(output) {
    var stdout = output.outcome && output.outcome.stdout ? String(output.outcome.stdout) : "";
    var lines = stdout.split(/\r?\n/).filter(function (line) {
        return line.trim() !== "";
    });
    return lines.length > 0 ? lines[lines.length - 1] : "";
}

/**
 * Reads the output of the command from buildCommand and calls onGpos with the GPOs that could be read.
 * Reports the failure instead when the command failed or no GPO could be read.
 * @param {Object} output The output of the WinRM command, including outcome and error.
 * @param {Function} onGpos Called with the GPOs read (at least one)
 */
function readGpos(output, onGpos) {
    if (output.error !== null && output.error !== undefined) {
        checkWinRmError(output.error);
        return;
    }
    var result;
    try {
        result = JSON.parse(lastStdoutLine(output));
    } catch (e) {
        console.error("Unable to parse the WinRM output: " + e.message);
        logStderr(output);
        D.failure(D.errorType.PARSING_ERROR);
        return;
    }
    if (!result || typeof result !== "object" || !Object.prototype.hasOwnProperty.call(result, "gpos")) {
        console.error("Unexpected WinRM output: " + JSON.stringify(result));
        logStderr(output);
        D.failure(D.errorType.PARSING_ERROR);
        return;
    }
    asList(result.errors).forEach(function (error) {
        console.error("GPO not read: " + error);
    });
    var gpos = asList(result.gpos).filter(function (gpo) {
        return gpo && gpo.Name;
    });
    if (gpos.length === 0) {
        console.error("No GPO could be read");
        D.failure(D.errorType.GENERIC_ERROR);
        return;
    }
    onGpos(gpos);
}

/**
* @remote_procedure
* @label Validate WinRM is working on device
* @documentation This procedure is used to validate if the driver can be applied on a device during association as well as validate any credentials provided
*/
function validate() {
    winrmConfig.command = buildCommand(gpoNames);
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        readGpos(output, function () {
            D.success();
        });
    });
}

/**
 * @remote_procedure
 * @label Get GPO version status
 * @documentation This procedure retrieves the status and version of selected GPOs, and creates a custom driver table with the results
 */
function get_status() {
    winrmConfig.command = buildCommand(gpoNames);
    D.device.sendWinRMCommand(winrmConfig, function (output) {
        readGpos(output, fillTable);
    });
}

/**
 * Populate the custom driver table
 * @param {Array} gpos The GPOs read
 */
function fillTable(gpos) {
    gpos.forEach(function (gpo) {
        gpoTable.insertRecord(String(gpo.Name).slice(0, 50), [
            gpo.Status,
            gpo.UADVersion,
            gpo.USVVersion,
            gpo.CADVersion,
            gpo.CSVVersion
        ]);
    });
    D.success(gpoTable);
}
