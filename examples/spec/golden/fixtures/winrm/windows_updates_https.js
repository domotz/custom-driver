// Same replies as windows_updates.js: the HTTPS copy of the driver runs the same commands, only the WinRM
// transport options (port 5986, scheme https) differ, and the replay does not see the transport.
// Shape: see the sibling fixture's header (Get-HotFix table; ConvertTo-Json of Microsoft.Update.Searcher IUpdate).
const sibling = require("./windows_updates.js");

module.exports = {
    cases: sibling.cases.map((c) => {
        if (!/bare object/.test(c.name)) return c;
        // windows_updates_https.js lacks the bare-object normalisation windows_updates.js got in 9fbf87b: a single
        // pending update gives an empty table and zero counters. Today's output is recorded as is (reported as a bug).
        const entryPoints = Object.assign({}, c.entryPoints);
        entryPoints.get_status = Object.assign({}, entryPoints.get_status, { expect: { allowEmptyTable: true } });
        return Object.assign({}, c, { entryPoints });
    })
};
