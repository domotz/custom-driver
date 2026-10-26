# Driver specs

This folder holds three kinds of specs, all run by Jasmine from `examples/`:

- the robustness net (`robustness_spec.js` plus `net/`), generated for every catalogue driver;
- the harness specs (`net/*_spec.js`), which test the net itself;
- hand-written legacy and happy-path specs (`apache2_status_spec.js`, `mysql_spec.js`, ...).

## Running

```
cd examples
npm test                      # the net, the harness specs and the legacy specs
npm run test:net              # only the net (robustness_spec.js)
NET_DRIVER=apache2 npm run test:net   # only drivers whose path contains "apache2"
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

Known behaviour changes that were deliberately not made are listed under "Needs Andrea" in
`docs/superpowers/notes/2026-10-26-robustness-baseline.md`.

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
