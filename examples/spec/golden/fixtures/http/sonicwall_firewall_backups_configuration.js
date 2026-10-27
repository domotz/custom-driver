// Simulated SonicWall SonicOS 7.x replies. Shape follows the SonicOS 7 API: POST /api/sonicos/tfa answers
// { status: { success, info: [{ level, code, message, bearer_token }] } }, POST /api/sonicos/auth answers the
// same envelope without a token (session cookie), GET /api/sonicos/export/current-config/cli with
// Accept: application/json answers the configuration as JSON whose numeric flags are bare hex literals
// (0x...), which is why the driver quotes and unquotes them. The export is requested with encoding: null, so
// the `request` library hands the body over as a Buffer.
// Case 1: 2FA account (bearer token). Case 2: no 2FA, /tfa is refused and the driver falls back to /auth.
const reply = require("../../replies");

const CONFIG = `{
  "system_time": "2026-01-15 10:00:00",
  "firewall_name": "TZ370-HQ",
  "administration": {
    "name": "TZ370-HQ",
    "admin_user": { "name": "admin", "password": "6,H2gJ8EJ0mQ==", "flags": 0x00000001 }
  },
  "interfaces": [
    { "name": "X0", "ip": "192.168.1.1", "netmask": "255.255.255.0", "zone": "LAN", "mgmt": 0x1f },
    { "name": "X1", "ip": "203.0.113.2", "netmask": "255.255.255.248", "zone": "WAN", "mgmt": 0x0a }
  ],
  "access_rules": [
    { "from": "LAN", "to": "WAN", "action": "allow", "service": "any" },
    { "from": "WAN", "to": "LAN", "action": "deny", "service": "any" }
  ]
}
`;

const exportReply = () => {
    const body = Buffer.from(CONFIG, "utf8");
    return [null, { statusCode: 200, headers: { "content-type": "application/json" }, body }, body];
};

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.sonicwall-bearer";
const tfaOk = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success.", bearer_token: TOKEN }] } };
const authOk = { status: { success: true, info: [{ level: "info", code: "E_OK", message: "Success." }] } };
const refused = { status: { success: false, info: [{ level: "error", code: "E_UNAUTHORIZED", message: "Not authorized." }] } };

const bearerCalls = [
    { kind: "http", method: "post", target: "/api/sonicos/tfa", body: /"tfa":"\d{6}"/, reply: reply.http(200, tfaOk) },
    { kind: "http", method: "get", target: "/api/sonicos/export/current-config/cli", headers: { Authorization: "Bearer " + TOKEN }, reply: exportReply() }
];
const cookieCalls = [
    { kind: "http", method: "post", target: "/api/sonicos/tfa", reply: reply.http(401, refused) },
    { kind: "http", method: "post", target: "/api/sonicos/auth", reply: reply.http(200, authOk) },
    { kind: "http", method: "get", target: "/api/sonicos/export/current-config/cli", reply: exportReply() }
];

module.exports = {
    cases: [
        {
            name: "2FA bearer token",
            parameters: { customPort: 443, totpSeed: "JBSWY3DPEHPK3PXP" },
            entryPoints: { validate: { calls: bearerCalls }, backup: { calls: bearerCalls } }
        },
        {
            name: "no 2FA, session cookie",
            parameters: { customPort: 8443, totpSeed: " " },
            entryPoints: { validate: { calls: cookieCalls }, backup: { calls: cookieCalls } }
        }
    ]
};
