// Simulated TLS handshake. Shape follows the sandbox D.device.http.getTLSCertificate documentation
// (remote_pawn_ng library/device.js): callback(null, { issuer, expiry, valid, certError }), expiry in the
// OpenSSL "Mon DD HH:MM:SS YYYY GMT" form. There is no replies.js builder for the tls kind.
const calls = [{
    kind: "tls",
    method: "getTLSCertificate",
    reply: [null, { issuer: "DigiCert Inc", expiry: "Mar  5 23:59:59 2027 GMT", valid: true, certError: null }]
}];

module.exports = {
    cases: [{
        name: "valid certificate",
        entryPoints: {
            validate: { calls },
            // A valid certificate has no authorization error: certError is legitimately null.
            get_status: { calls, expect: { nullValues: ["certError"] } }
        }
    }]
};
