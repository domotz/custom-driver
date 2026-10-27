# Driver specs

This folder holds four kinds of specs, all run by Jasmine from `examples/`:

- the robustness net (`robustness_spec.js` plus `net/`), generated for every catalogue driver;
- the golden success paths (`golden_spec.js` plus `golden/`), for drivers that have a fixture;
- the harness specs (`net/*_spec.js`, `golden/harness_spec.js`), which test the two harnesses;
- hand-written legacy and happy-path specs (`apache2_status_spec.js`, `mysql_spec.js`, ...).

## Running

```
cd examples
npm test                      # the net, the harness specs and the legacy specs
npm run test:net              # only the net (robustness_spec.js)
NET_DRIVER=apache2 npm run test:net   # only drivers whose path contains "apache2"
npm run test:golden           # only the golden success paths
UPDATE_GOLDEN=1 npm run test:golden   # rewrite the golden snapshots (GOLDEN_DRIVER=<substring> to limit)
npm run lint
```

Node requirement: `cheerio` needs Node >= 20.18.1 (declared in `package.json` `engines`), so any future
GitHub CI must use Node >= 20.18.1.

CI must run both `npm run lint` and `npm test`. The net runs drivers under SES, where a call to a
misspelled function inside a branch the scenarios never reach goes unnoticed; eslint's `no-undef` rule
is what catches those typos.

## The robustness net

For each driver, each entry point (`validate`, `get_status`, `backup`, `custom_N`) and each hostile scenario (device
refuses, answers empty, answers garbage, never answers, ...), the net runs the driver the way the
collector sandbox does: a fresh SES Compartment with the same endowments and the same async wrapper,
against a strict fake `D`. A case passes when the driver reports exactly through `D.success` or
`D.failure` (or a production-acceptable error report) and nothing escapes. A failure message starts
with one of these reasons:

| reason | meaning | typical fix |
| --- | --- | --- |
| `crash in <where>: ...` | an exception escaped from an unwrapped callback, timer or socket event; in production this kills the script | guard the callback with try/catch, or check the argument before use |
| `unhandled rejection: ...` | a promise rejected with no handler | add a terminal `.catch` that reports |
| `unknown sandbox member D.x.y` | the driver reads something the sandbox does not provide | remove the call or use a real `D` API |
| `uses require/import, not allowed in the sandbox` | the driver can never run in production | remove it |
| `broken under SES strict mode: ...` | a ReferenceError (implicit global, typo) or parse-time SyntaxError (e.g. legacy octal literal) | fix the code bug |
| `runaway: more than 200 transport calls ...` | a retry or polling loop that never stops | bound the loop |
| `never reported: went idle ...` | nothing pending and no report; production runs into the script timeout | report on every path (add the missing `else` or `.catch`) |
| `timed out after N ms without reporting` | still pending at the time limit with no report | make sure a failed or silent device ends in `D.failure` |
| `never reported` | the run ended with no report and none of the reasons above (a fallback; the two "never reported"/"timed out" rows above are the usual form) | as for `never reported: went idle ...` |

Known issues deliberately left alone, because fixing them changes what a driver reports on a working device:

- `ssh/mysql.js` never reports `usedRam`: `parse()` expects the pmap line first, but the command prints the
  service status line first (pinned by `mysql_spec.js`).
- `telnet/epson_projector_via_pj_link.js` reports success when the projector never answers (the socket
  `timeout` handler resolves), and likewise after a `PJLINK 1` greeting whose seed is not 8 characters.
- `winrm/windows_host_users.js` has its `@remote_procedure` comment above `parseValidateOutput()` instead of
  `validate()` (the only exception in `catalogue_spec.js`).
- IBM FlashSystem 5000 drivers (found by the golden fixtures; the snapshots pin today's output, not the right one):
  - `general_information`, `storage_pools_information`, `physical_drives_info` strip the unit from capacities, so
    `812.50GB` is reported as 812.5 in a TB (or MB) column;
  - `managed_disks_information` calls `storeResponse(response, endpoint, key)` with one argument too many, so every
    MDisk gets the first array's pool, capacity, RAID level and status (a degraded MDisk shows online);
  - `physical_drives_info` joins `lsdrive.id` with `lsarraymember.member_id` instead of `drive_id`;
  - `volume_management` merges the volume copy over the volume, so Status always equals Copy Status;
  - `formatDate` (cloud_call_home_information, enclosure_statistics, updates, volume_management) does not zero-pad.

Size (2026-10-26): 276 drivers, 583 entry points (`validate` 276, `get_status` 265, `backup` 11,
`custom_N` 31 in 14 drivers) × 8 scenarios = 4,664 net cases; `npm test` runs 4,904 specs in about 45 s.
Entry points are found by `net/catalogue.js` (`ENTRY_POINT_RE`), which also accepts a declaration
written right after a JSDoc block (`*/function validate() {`).

## Wrapped and unwrapped callbacks (7.4.4+)

From collector 7.4.4 the sandbox wraps in try/catch the callbacks of `D.device.http.get/post/put/delete`,
`sendSSHCommand`, `sendTelnetCommand`, `sendTCPCommand` and `D.device.snmp.get/walk/getRaw/set`. An
exception thrown there becomes a `GENERIC_ERROR` report, so it passes (except a ReferenceError, which
is a code bug). Callbacks of every other API (for example `sendWinRMCommand`, `sendWMICommand`, raw
sockets, timers) are unwrapped: an exception there is a crash. The list is `WRAPPED` in
`net/fake-d.js`; keep it in sync with remote_pawn_ng.

## Golden success paths

The net proves a driver survives a hostile device; the golden specs prove it still reports the right
thing for a healthy one. A fixture `golden/fixtures/<dir>/<driver>.js` (same path as the driver) lists,
for each entry point, the transport calls a healthy device answers and the replies:

```js
const reply = require("../../replies");
module.exports = {
    cases: [{
        name: "ubuntu 22.04",
        parameters: {},                       // D.getParameter values
        entryPoints: {
            get_status: {
                calls: [{ kind: "ssh", method: "sendSSHCommand", target: "df -Th", reply: reply.ssh(DF) }],
                expect: {}                    // optional: nullValues: [uid], allowEmptyTable, skipExpectedVariables
            }
        }
    }],
    skipEntryPoints: {}                       // optional: { custom_1: "why it has no fixture" }
};
```

`target` is the URL (http), the command (ssh, telnet, tcp, winrm) or the OID (snmp), as a string or a
RegExp; `host` pins an external device. `golden/replies.js` builds the production reply shape of each
kind. Each entry point runs in the net's production-style runner with a fixed clock (`golden/clock.js`,
TZ=UTC) and must:

1. pass the net verdict;
2. make exactly the fixture's calls (an unexpected call gets no answer and is listed);
3. report one `D.success` that production accepts (uid, name, value, table label and column limits from
   remote_pawn_ng `library/metric.js`, `library/table.js`, `sandbox.js`) whose variable or column count
   matches the companion `expected_variables` (`"[N]"` exactly N, `"[N,M]"` N to M, for `get_status`);
4. equal its snapshot in `golden/snapshots/<dir>/<driver>.json`.

A new fixture has no snapshot and fails until `UPDATE_GOLDEN=1` records one. Update mode records only runs
that pass checks 1 to 3. Review a snapshot diff like code: it is the driver's output on a healthy device.

Write replies from real device output where possible (a capture, the vendor's API reference examples, the
command's documented format), and say where they come from in a comment at the top of the fixture.

## Adding a happy-path spec

Use `helpers/mock-d.js`. `createMockD(options)` builds a recording fake `D`; `loadDriver(path, d)`
runs the driver source against it and returns its top-level functions. See `apache2_status_spec.js`:

```js
var harnessLib = require("./helpers/mock-d");

describe("http/apache2_status driver", function () {
    var driver;
    beforeEach(function () {
        driver = harnessLib.loadDriver("http/apache2_status.js", harnessLib.createMockD());
    });
    it("parses the status text", function () {
        expect(driver.convertToJson("Uptime: 3600").ServerUptimeSeconds).toEqual(3600);
    });
});
```

Name the file `<driver>_spec.js` in this folder (Jasmine picks up `spec/**/*_spec.js`).
