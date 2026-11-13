// Simulated pfSense 2.7.2 web GUI replies. Shape follows the pfSense webConfigurator flow: every page embeds
// `var csrfMagicToken = "sid:<hash>,<timestamp>";` (csrf-magic), POST /index.php with login=Login answers a 302
// to the requested page, and POST /diag_backup.php with download=download answers config.xml as an
// attachment (<?xml version="1.0"?><pfsense>...</pfsense>).
const reply = require("../../replies");

const page = (token) => "<!DOCTYPE html><html><head><title>pfSense.home.arpa - Diagnostics: Backup &amp; Restore</title>" +
    "<script type=\"text/javascript\">//<![CDATA[\nvar csrfMagicToken = \"" + token + "\";var csrfMagicName = \"__csrf_magic\";//]]></script></head><body></body></html>";

const CONFIG_XML = `<?xml version="1.0"?>
<pfsense>
\t<version>23.3</version>
\t<lastchange></lastchange>
\t<system>
\t\t<optimization>normal</optimization>
\t\t<hostname>pfSense</hostname>
\t\t<domain>home.arpa</domain>
\t\t<dnsserver>9.9.9.9</dnsserver>
\t\t<timezone>Europe/Rome</timezone>
\t\t<user>
\t\t\t<name>admin</name>
\t\t\t<descr><![CDATA[System Administrator]]></descr>
\t\t\t<scope>system</scope>
\t\t\t<bcrypt-hash>$2y$10$abcdefghijklmnopqrstuuAbCdEfGhIjKlMnOpQrStUvWxYz01234</bcrypt-hash>
\t\t</user>
\t</system>
\t<interfaces>
\t\t<wan><if>igb0</if><descr>WAN</descr><enable></enable><ipaddr>dhcp</ipaddr></wan>
\t\t<lan><if>igb1</if><descr>LAN</descr><enable></enable><ipaddr>192.168.1.1</ipaddr><subnet>24</subnet></lan>
\t</interfaces>
</pfsense>
`;

const redirect = () => [null, { statusCode: 302, headers: { location: "/diag_backup.php" }, body: "" }, ""];
const download = () => [null, {
    statusCode: 200,
    headers: { "content-type": "application/octet-stream", "content-disposition": "attachment; filename=config-pfSense.home.arpa-20260115100000.xml" },
    body: CONFIG_XML
}, CONFIG_XML];

const loginCalls = [
    { kind: "http", method: "get", target: "/diag_backup.php", reply: reply.http(200, page("sid:11aa22bb33cc44dd55ee66ff77889900aabbccdd,1768471200")) },
    { kind: "http", method: "post", target: "/index.php", reply: redirect() },
    { kind: "http", method: "get", target: "/diag_backup.php", reply: reply.http(200, page("sid:99ff88ee77dd66cc55bb44aa33221100ffeeddcc,1768471201")) }
];
const backupCalls = loginCalls.concat([
    { kind: "http", method: "post", target: "/diag_backup.php", reply: download() }
]);

module.exports = {
    cases: [{
        name: "pfSense 2.7.2",
        entryPoints: { validate: { calls: loginCalls }, backup: { calls: backupCalls } }
    }]
};
