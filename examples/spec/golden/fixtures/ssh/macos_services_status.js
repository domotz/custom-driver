// Simulated macOS 14.5 `sudo launchctl list | grep -E '<labels>'` output. Shape follows launchctl list: tab separated
// "PID  Status  Label" lines (the header line does not match the grep), PID "-" when the job is not running, Status the
// last exit status of the job (0 = clean exit, a positive value is the exit code, a negative value is minus the signal
// that killed it).
const reply = require("../../replies");

const COMMAND = "sudo launchctl list | grep -E 'com.openssh.sshd|com.apple.cfprefsd.xpc.daemon|com.apple.mdworker.shared|com.apple.analyticsd|com.apple.backupd|com.apple.softwareupdated'";

const LIST = [
    "612\t0\tcom.openssh.sshd",
    "403\t0\tcom.apple.cfprefsd.xpc.daemon",
    "-\t0\tcom.apple.mdworker.shared",
    "-\t-15\tcom.apple.analyticsd",
    "-\t78\tcom.apple.backupd",
    "-\t1\tcom.apple.softwareupdated",
    ""
].join("\n");

const call = () => ({ kind: "ssh", method: "sendSSHCommand", target: COMMAND, reply: reply.ssh(LIST) });

module.exports = {
    cases: [{
        name: "macos 14.5",
        parameters: { services: ["com.openssh.sshd", "com.apple.cfprefsd.xpc.daemon", "com.apple.mdworker.shared", "com.apple.analyticsd", "com.apple.backupd", "com.apple.softwareupdated"] },
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
