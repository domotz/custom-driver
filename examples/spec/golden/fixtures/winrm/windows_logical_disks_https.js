// Same replies as windows_logical_disks.js: the HTTPS copy of the driver runs the same commands, only the WinRM
// transport options (port 5986, scheme https) differ, and the replay does not see the transport.
// Shape: see the sibling fixture's header (ConvertTo-Json of MSFT_Volume and Get-BitLockerVolume).
// Extra case: a single volume is a bare object (ConvertTo-Json), which windows_logical_disks.js handles since 9fbf87b.
const sibling = require("./windows_logical_disks.js");

const single = (() => {
    const base = sibling.cases[0];
    const calls = base.entryPoints.get_status.calls.map((call, i) => {
        if (i !== 0) return call;
        const stdout = JSON.parse(call.reply[0].outcome.stdout)[0];
        return Object.assign({}, call, { reply: [{ outcome: Object.assign({}, call.reply[0].outcome, { stdout: JSON.stringify(stdout) + "\r\n" }), error: null }] });
    });
    return Object.assign({}, base, {
        name: "winrm, one volume is a bare object",
        // windows_logical_disks_https.js lacks the bare-object normalisation: the table comes out empty (reported as a bug).
        entryPoints: { validate: { calls }, get_status: { calls, expect: { allowEmptyTable: true } } }
    });
})();

module.exports = { cases: sibling.cases.concat([single]) };
