// Simulated TLS handshakes. Shape follows the sandbox D.device.http.getTLSCertificate documentation
// (remote_pawn_ng library/device.js): callback(null, { issuer: cert.issuer.O, expiry: cert.valid_to,
// valid: !authorizationError, certError: authorizationError }). valid_to is the OpenSSL
// "Mon DD HH:MM:SS YYYY GMT" form, with a space-padded day. One valid, one expired, one self-signed certificate.
// There is no replies.js builder for the tls kind, so the callback arguments are written by hand.
const tls = (issuer, expiry, valid, certError) => [null, { issuer, expiry, valid, certError }];

const calls = [
    { kind: "tls", method: "getTLSCertificate", host: "www.example.com", reply: tls("DigiCert Inc", "Mar  5 23:59:59 2027 GMT", true, null) },
    { kind: "tls", method: "getTLSCertificate", host: "old.example.org", reply: tls("Let's Encrypt", "Nov 12 08:30:00 2025 GMT", false, "CERT_HAS_EXPIRED") },
    { kind: "tls", method: "getTLSCertificate", host: "router.lan", reply: tls("Router CA", "Jun 30 12:00:00 2026 GMT", false, "DEPTH_ZERO_SELF_SIGNED_CERT") }
];

module.exports = {
    cases: [{
        name: "valid, expired and self-signed certificates",
        parameters: { serversToCheck: ["www.example.com", "old.example.org", "router.lan"] },
        entryPoints: {
            validate: { calls },
            get_status: { calls }
        }
    }]
};
