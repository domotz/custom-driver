// Simulated Windows Server 2019 / PowerShell 5.1 replies. Shape follows the documented `quser` output (fixed-width
// columns USERNAME, SESSIONNAME, ID, STATE, IDLE TIME, LOGON TIME; an en-US date and 12-hour time; SESSIONNAME is blank
// for a disconnected session, IDLE TIME is "none", "." or [d+][h:]mm; a leading ">" only marks the caller's own session,
// which a WinRM/SSH shell does not have), run through `Start-Process quser -NoNewWindow`. The SSH mode runs the same
// command through `powershell -Command`.
const reply = require("../../replies");

const COMMAND = 'Start-Process quser -NoNewWindow -RedirectStandardError "NUL"';
const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';

const QUSER = [
    " USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME",
    " administrator         console             1  Active      none   1/12/2026 8:05 AM",
    " jsmith                rdp-tcp#12          3  Active         14  1/14/2026 4:30 PM",
    " bwayne                                    4  Disc      2+03:10  1/13/2026 11:47 AM",
    ""
].join("\r\n");

const QUSER_ONE = [
    " USERNAME              SESSIONNAME        ID  STATE   IDLE TIME  LOGON TIME",
    " administrator         console             1  Active      none   1/12/2026 8:05 AM",
    ""
].join("\r\n");

const winrm = (stdout) => [{ kind: "winrm", method: "sendWinRMCommand", target: COMMAND, reply: reply.winrm(stdout) }];
const sshCalls = (stdout) => [{ kind: "ssh", method: "sendSSHCommand", target: ssh(COMMAND), reply: reply.ssh(stdout) }];

module.exports = {
    cases: [{
        name: "winrm, three sessions",
        parameters: { protocol: "winrm" },
        entryPoints: { validate: { calls: winrm(QUSER) }, get_status: { calls: winrm(QUSER) } }
    }, {
        name: "winrm, one session",
        parameters: { protocol: "winrm" },
        entryPoints: { validate: { calls: winrm(QUSER_ONE) }, get_status: { calls: winrm(QUSER_ONE) } }
    }, {
        name: "ssh, three sessions",
        parameters: { protocol: "ssh" },
        entryPoints: { validate: { calls: sshCalls(QUSER) }, get_status: { calls: sshCalls(QUSER) } }
    }]
};
