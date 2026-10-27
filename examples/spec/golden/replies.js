/**
 * Success-reply builders for golden fixtures. Each returns the positional callback args that the
 * production sandbox library for that kind sends on success; the shapes are the ones cited in
 * net/scenarios.js (remote_pawn_ng src/sandbox/library/*).
 */

// http: the `request` library's (error, response, body).
const http = (statusCode, body, headers) => {
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return [null, { statusCode, headers: headers || {}, body: text }, text];
};

// sendSSHCommand: (stdout, null). sshNode.js trims stdout on exit (sendSSHCommands does not).
const ssh = (stdout) => [stdout.trim(), null];

// sendSSHCommands: one output string per command.
const sshCommands = (outputs) => [outputs, null];

// sendTelnetCommand: (response, "") - telnetSend.js starts the error as "".
const telnet = (response) => [response, ""];

// sendTCPCommand and raw sockets: (response, null).
const tcp = (response) => [response, null];

// sendWinRMCommand: { outcome: { exitCode, stdout, stderr, durationMs }, error: null }.
const winrm = (stdout, stderr, exitCode) => [{
    outcome: { exitCode: exitCode || 0, stdout, stderr: stderr || "", durationMs: 120 },
    error: null
}];

// snmp get/walk: an object of OID -> value, every value already a string (snmp.js getOutputFromVarbinds),
// except Counter64 which is a number.
const snmp = (varbinds) => [varbinds, null];

module.exports = { http, ssh, sshCommands, telnet, tcp, winrm, snmp };
