// Simulated Windows Server 2019 (PowerShell 5.1) `Get-LocalUser` output. Shape follows the default table view:
// a blank line, the "Name Enabled Description" header with its dashed underline, then one line per account;
// Description is the last column (cut with "..." when wider than the console) and may be empty.
// The SSH case runs the same command through `powershell -Command "..."` (sendSSHCommand output, trimmed).
const reply = require("../../replies");

const USERS = [
    "",
    "Name               Enabled Description",
    "----               ------- -----------",
    "Administrator      True    Built-in account for administering the computer/domain",
    "DefaultAccount     False   A user account managed by the system.",
    "Guest              False   Built-in account for guest access to the computer/domain",
    "john.doe           True    Marketing manager",
    "svc_backup         True",
    "WDAGUtilityAccount False   A user account managed and used by the system for Windows Defender Applicati...",
    ""
].join("\r\n");

const WSMAN = [
    "",
    "wsmid           : http://schemas.dmtf.org/wbem/wsman/identity/1/wsmanidentity.xsd",
    "ProtocolVersion : http://schemas.dmtf.org/wbem/wsman/1/wsman.xsd",
    "ProductVendor   : Microsoft Corporation",
    "ProductVersion  : OS: 0.0.0 SP: 0.0 Stack: 3.0",
    ""
].join("\r\n");

const ssh = (command) => 'powershell -Command "' + command.replace(/"/g, '\\"') + '"';
const winrmCall = (target, out) => ({ kind: "winrm", method: "sendWinRMCommand", target, reply: reply.winrm(out) });
const sshCall = (target, out) => ({ kind: "ssh", method: "sendSSHCommand", target: ssh(target), reply: reply.ssh(out) });

module.exports = {
    cases: [{
        name: "winrm, local accounts",
        parameters: { protocol: "WINRM" },
        entryPoints: {
            validate: { calls: [winrmCall("Test-WSMan", WSMAN)] },
            get_status: { calls: [winrmCall("Get-LocalUser", USERS)] }
        }
    }, {
        name: "ssh, local accounts",
        parameters: { protocol: "SSH" },
        entryPoints: {
            validate: { calls: [sshCall("Test-WSMan", WSMAN)] },
            get_status: { calls: [sshCall("Get-LocalUser", USERS)] }
        }
    }]
};
