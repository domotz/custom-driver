// Simulated Windows Server 2019 / PowerShell 5.1 over OpenSSH. Shape follows what PowerShell prints for the command's
// final expression, a hashtable: a "Name  Value" table with a dashes line and one line per key (IsRebootPending, Uptime),
// the blank line before the table is removed by sendSSHCommand's trim. `Restart-Computer -Force` prints nothing.
const reply = require("../../replies");

const table = (pending, uptime) => [
    "",
    "Name                           Value",
    "----                           -----",
    "IsRebootPending                " + pending,
    "Uptime                         " + uptime,
    "",
    ""
].join("\r\n");

const status = (pending, uptime) => ({
    kind: "ssh", method: "sendSSHCommand", target: /Invoke-WmiMethod.*IsRebootPending = \$isRebootPending/,
    reply: reply.ssh(table(pending, uptime))
});

module.exports = {
    cases: [
        {
            name: "no reboot pending",
            entryPoints: {
                validate: { calls: [status("False", 5)] },
                get_status: { calls: [status("False", 5)] },
                custom_1: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: 'powershell -c "Restart-Computer -Force"', reply: reply.ssh("") }] }
            }
        },
        {
            name: "reboot pending",
            entryPoints: {
                validate: { calls: [status("True", 17)] },
                get_status: { calls: [status("True", 17)] },
                custom_1: { calls: [{ kind: "ssh", method: "sendSSHCommand", target: 'powershell -c "Restart-Computer -Force"', reply: reply.ssh("") }] }
            }
        }
    ]
};
