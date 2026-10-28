// Simulated OpenSSL 1.1.1 output of `echo | openssl s_client -servername H -connect H 2>/dev/null | openssl x509 -enddate
// -issuer -noout`. Shape follows openssl-x509(1): "notAfter=Mon DD HH:MM:SS YYYY GMT" and "issuer=C = US, O = ..., CN = ...".
// One certificate is valid, one has expired (the golden clock is 2026-01-15).
const reply = require("../../replies");

const command = (host) => "echo | openssl s_client -servername " + host + " -connect " + host + " 2>/dev/null | openssl x509 -enddate -issuer -noout";

const VALID = "notAfter=Jun 12 23:59:59 2026 GMT\nissuer=C = US, O = Let's Encrypt, CN = R3\n";
const EXPIRED = "notAfter=Nov  3 12:00:00 2025 GMT\nissuer=C = US, O = DigiCert Inc, CN = DigiCert TLS RSA SHA256 2020 CA1\n";

const calls = () => [
    { kind: "ssh", method: "sendSSHCommand", target: command("www.example.com:443"), reply: reply.ssh(VALID) },
    { kind: "ssh", method: "sendSSHCommand", target: command("old.example.org:8443"), reply: reply.ssh(EXPIRED) }
];

module.exports = {
    cases: [{
        name: "ubuntu 20.04",
        parameters: { serversToCheck: ["www.example.com:443", "old.example.org:8443"] },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
