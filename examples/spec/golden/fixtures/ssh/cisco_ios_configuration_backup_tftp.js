// Simulated Cisco IOS SSH session. validate opens the session with no command (sendSSHCommands with an empty
// command list); the sandbox answers one output string per command, so an empty list.
// backup is skipped: it goes through D.tftpServer.accept(options, onReady, onUploadEnd) and the fake D
// (net/fake-d.js) delivers only the first callback (onReady) from one replay reply; the upload callback
// that carries the file and reports the backup can never be driven by a fixture.
const reply = require("../../replies");

module.exports = {
    skipEntryPoints: { backup: "fake D tftpServer.accept cannot deliver the onUploadEnd callback that reports the backup" },
    cases: [{
        name: "Catalyst IOS 15.2",
        entryPoints: {
            validate: {
                calls: [{ kind: "sshCommands", method: "sendSSHCommands", target: "", reply: reply.sshCommands([]) }]
            }
        }
    }]
};
