// Simulated vCenter Server Appliance 8.0.2 replies. Shape follows the vSphere Automation REST API
// (certificate-management/vcenter: tls Info with serial_number, issuer_dn, key_usage, valid_to; signing-certificate
// with signing_cert_chains and active_cert_chain; trusted-root-chains list and chain detail) and, over SSH, the
// appliancesh session: "shell.set --enabled true", "shell", then `echo "<PEM>" | openssl x509 -text`, each output
// being the echoed command, its output and the next prompt, with \r\n line ends (sendSSHCommands does not trim).
// The openssl 3 "x509 -text" layout (Serial Number on its own line, "Not After : ", "X509v3 Key Usage: critical") is
// the documented one; the PEM bodies are fake.
const reply = require("../../replies");

const SID = "9c8b7a6d5e4f3a2b1c0d9e8f7a6b5c4d";
const auth = { "vmware-api-session-id": SID };

function pem(seed) {
    return "-----BEGIN CERTIFICATE-----\n" + seed + "MIIDdzCCAl+gAwIBAgIJAJ0xYQe8Zl3JMA0GCSqGSIb3DQEBCwUAMGIx\n" + seed + "CzAJBgNVBAYTAlVTMRMwEQYDVQQIDApDYWxpZm9ybmlhMRwwGgYDVQQKDBN2\n-----END CERTIFICATE-----";
}

const signingPem = pem("S1");
const activePem = pem("S2");
const rootPem1 = pem("R1");
const rootPem2 = pem("R2");

function x509(serial, notAfter, subjectOu, usage) {
    return [
        "Certificate:",
        "    Data:",
        "        Version: 3 (0x2)",
        "        Serial Number:",
        "            " + serial,
        "        Signature Algorithm: sha256WithRSAEncryption",
        "        Issuer: CN = CA, DC = vsphere, DC = local, C = US, ST = California, O = vcenter.lab.local, OU = VMware Engineering",
        "        Validity",
        "            Not Before: Mar  2 10:15:30 2026 GMT",
        "            Not After : " + notAfter,
        "        Subject: CN = CA, DC = vsphere, DC = local, C = US, ST = California, O = vcenter.lab.local, OU = " + subjectOu,
        "        X509v3 extensions:",
        "            X509v3 Key Usage: critical",
        "                " + usage,
        "            X509v3 Basic Constraints: critical",
        "                CA:TRUE",
        "    Signature Algorithm: sha256WithRSAEncryption"
    ].join("\r\n");
}

const COMMANDS = [
    "shell.set --enabled true",
    "shell",
    'echo "' + signingPem + "\n" + activePem + '" | openssl x509 -text',
    'echo "' + rootPem1 + "," + rootPem2 + '" | openssl x509 -text'
];

// The terminal echoes the typed command, the quoted PEM spanning lines with "> " continuation prompts.
function typed(command) {
    return command.replace(/\n/g, "\r\n> ");
}

const PROMPT = "root@vcenter [ ~ ]# ";
const sshOut = [
    "Command> shell.set --enabled true\r\nCommand> ",
    "shell\r\n" + PROMPT,
    typed(COMMANDS[2]) + "\r\n" + x509("7b:3c:19:4e:aa:51:02:9d:6f:10", "Mar  2 10:15:30 2036 GMT", "VMware Engineering", "Certificate Sign, CRL Sign") + "\r\n" + PROMPT,
    typed(COMMANDS[3]) + "\r\n" + x509("0f:e4:71:2b:cd:88:13:5a:90:77", "Jan  3 08:00:00 2026 GMT", "VMware Trust", "Certificate Sign, CRL Sign") + "\r\n" + PROMPT
];

const tls = {
    cert: pem("T0"),
    valid_from: "2025-03-02T10:15:30.000Z",
    valid_to: "2026-03-02T10:15:30.000Z",
    issuer_dn: "CN=CA,DC=vsphere,DC=local,C=US,ST=California,O=vcenter.lab.local,OU=VMware Engineering",
    subject_dn: "CN=vcenter.lab.local,C=US,O=vcenter.lab.local,OU=VMware Engineering",
    serial_number: "3a:90:c4:11:7d:25:fe:06",
    key_usage: ["Digital Signature", "Key Encipherment"]
};

function calls() {
    return [
        { kind: "http", method: "post", target: "/api/session", reply: reply.http(201, JSON.stringify(SID)) },
        { kind: "http", method: "get", target: "/api/vcenter/certificate-management/vcenter/tls", headers: auth, reply: reply.http(200, tls) },
        {
            kind: "http", method: "get", target: "/api/vcenter/certificate-management/vcenter/signing-certificate", headers: auth,
            reply: reply.http(200, {
                signing_cert_chains: [{ cert_chain: [signingPem] }],
                active_cert_chain: { cert_chain: [activePem] }
            })
        },
        {
            kind: "http", method: "get", target: "/api/vcenter/certificate-management/vcenter/trusted-root-chains/", headers: auth,
            reply: reply.http(200, [{ chain: "A1B2C3" }, { chain: "D4E5F6" }])
        },
        {
            kind: "http", method: "get", target: "/api/vcenter/certificate-management/vcenter/trusted-root-chains/A1B2C3", headers: auth,
            reply: reply.http(200, { cert_chain: { cert_chain: [rootPem1] } })
        },
        {
            kind: "http", method: "get", target: "/api/vcenter/certificate-management/vcenter/trusted-root-chains/D4E5F6", headers: auth,
            reply: reply.http(200, { cert_chain: { cert_chain: [rootPem2] } })
        },
        { kind: "sshCommands", method: "sendSSHCommands", target: /^shell\.set --enabled true\nshell\n/, reply: reply.sshCommands(sshOut) }
    ];
}

module.exports = {
    cases: [{
        name: "vcsa 8.0.2",
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
