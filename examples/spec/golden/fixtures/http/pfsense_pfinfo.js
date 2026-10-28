// Simulated pfSense 2.6.0 web GUI replies. Shape follows the "Diagnostics > pfInfo" page (diag_pf_info.php),
// which prints the FreeBSD pfctl output: `pfctl -s info` (status, hostid, State Table / Source Tracking Table /
// Counters / Limit Counters with Total and Rate columns, Syncookies, "Interface Stats for <loginterface>"),
// `pfctl -s timeout -v`, `pfctl -s memory` (hard limits) and `pfctl -vvsI` (per-interface Cleared / References
// / In4,Out4,In6,Out6 Pass,Block counters, FreeBSD pf prints "References:  <n>"). Sections are separated by
// <p/> lines in the refreshed fragment. Login flow: GET / (form with the __csrf_magic hidden input), POST /,
// GET /diag_pf_info.php (hidden input again), POST /diag_pf_info.php with refresh=yes.
const reply = require("../../replies");

const csrfPage = (token) => "<html><body><form method=\"post\"><input type=\"hidden\" name=\"__csrf_magic\" value=\"" + token + "\" /></form></body></html>";

const row = (name, total, rate) => "  " + name.padEnd(24) + String(total).padStart(12) + (rate === undefined ? "" : String(rate).padStart(14) + "/s");
const rowNoRate = (name, total) => "  " + name.padEnd(24) + String(total).padStart(12) + "              ";
const stats = (label, v4, v6) => "  " + label.padEnd(16) + String(v4).padStart(20) + String(v6).padStart(17);
const iface = (name, cleared, refs, c) => [
    name,
    "\tCleared:     " + cleared,
    "\tReferences:  " + refs,
    "\tIn4/Pass:    [ Packets: " + String(c[0]).padEnd(18) + "Bytes: " + String(c[1]).padEnd(18) + "]",
    "\tIn4/Block:   [ Packets: " + String(c[2]).padEnd(18) + "Bytes: " + String(c[3]).padEnd(18) + "]",
    "\tOut4/Pass:   [ Packets: " + String(c[4]).padEnd(18) + "Bytes: " + String(c[5]).padEnd(18) + "]",
    "\tOut4/Block:  [ Packets: " + String(c[6]).padEnd(18) + "Bytes: " + String(c[7]).padEnd(18) + "]",
    "\tIn6/Pass:    [ Packets: " + String(c[8]).padEnd(18) + "Bytes: " + String(c[9]).padEnd(18) + "]",
    "\tIn6/Block:   [ Packets: " + String(c[10]).padEnd(18) + "Bytes: " + String(c[11]).padEnd(18) + "]",
    "\tOut6/Pass:   [ Packets: " + String(c[12]).padEnd(18) + "Bytes: " + String(c[13]).padEnd(18) + "]",
    "\tOut6/Block:  [ Packets: " + String(c[14]).padEnd(18) + "Bytes: " + String(c[15]).padEnd(18) + "]"
].join("\n");

const PAGE = [
    "Status: Enabled for 12 days 04:09:11           Debug: Urgent",
    "<p/>",
    "Hostid:   0xa1b2c3d4",
    "Checksum: 0x0123456789abcdef0123456789abcdef",
    "<p/>",
    "State Table                          Total             Rate",
    rowNoRate("current entries", 1234),
    row("searches", 123456789, "117.4"),
    row("inserts", 2345678, "2.2"),
    row("removals", 2344444, "2.1"),
    "Source Tracking Table",
    rowNoRate("current entries", 0),
    row("searches", 0, "0.0"),
    row("inserts", 0, "0.0"),
    row("removals", 0, "0.0"),
    "Counters",
    row("match", 12345678, "11.7"),
    row("bad-offset", 0, "0.0"),
    row("fragment", 12, "0.0"),
    row("short", 3, "0.0"),
    row("normalize", 5, "0.0"),
    row("memory", 0, "0.0"),
    row("bad-timestamp", 0, "0.0"),
    row("congestion", 0, "0.0"),
    row("ip-option", 7, "0.0"),
    row("proto-cksum", 0, "0.0"),
    row("state-mismatch", 41, "0.0"),
    row("state-insert", 0, "0.0"),
    row("state-limit", 0, "0.0"),
    row("src-limit", 0, "0.0"),
    row("synproxy", 0, "0.0"),
    row("map-failed", 0, "0.0"),
    "Limit Counters",
    row("max states per rule", 0, "0.0"),
    row("max-src-states", 0, "0.0"),
    row("max-src-nodes", 0, "0.0"),
    row("max-src-conn", 0, "0.0"),
    row("max-src-conn-rate", 0, "0.0"),
    row("overload table insertion", 0, "0.0"),
    row("overload flush states", 0, "0.0"),
    row("synfloods detected", 0, "0.0"),
    row("syncookies sent", 0, "0.0"),
    row("syncookies validated", 0, "0.0"),
    "<p/>",
    "Adaptive Syncookies Watermarks",
    "  start                              25% (states 49500)",
    "  end                                12% (states 24750)",
    "<p/>",
    "Syncookies",
    "  mode                  adaptive",
    "<p/>",
    "Interface Stats for em1               IPv4             IPv6",
    stats("Bytes In", "1234567890", 5120),
    stats("Bytes Out", "987654321", 2048),
    "  Packets In",
    stats("  Passed", 1234567, 40),
    stats("  Blocked", 1234, 2),
    "  Packets Out",
    stats("  Passed", 987654, 31),
    stats("  Blocked", 0, 0),
    "<p/>",
    "Timeouts:",
    "tcp.first                   120s",
    "tcp.opening                  30s",
    "tcp.established           86400s",
    "tcp.closing                 900s",
    "tcp.finwait                  45s",
    "tcp.closed                   90s",
    "tcp.tsdiff                   30s",
    "udp.first                    60s",
    "udp.single                   30s",
    "udp.multiple                 60s",
    "icmp.first                   20s",
    "icmp.error                   10s",
    "other.first                  60s",
    "other.single                 30s",
    "other.multiple               60s",
    "frag                         30s",
    "interval                     10s",
    "adaptive.start            59400 states",
    "adaptive.end             118800 states",
    "src.track                     0s",
    "<p/>",
    "Limits:",
    "states        hard limit   198000",
    "src-nodes     hard limit   198000",
    "frags         hard limit     5000",
    "table-entries hard limit   400000",
    "<p/>",
    "Interface Statistics",
    iface("all", "Thu Jan  1 00:00:00 2026", 0, [1300000, 1400000000, 1500, 90000, 1000000, 1100000000, 10, 800, 40, 5000, 2, 160, 31, 2400, 0, 0]),
    iface("em0", "Thu Jan  1 00:00:00 2026", 4, [800000, 900000000, 1400, 80000, 600000, 700000000, 0, 0, 20, 2500, 2, 160, 15, 1200, 0, 0]),
    iface("em1", "Thu Jan  1 00:00:00 2026", 9, [500000, 500000000, 100, 10000, 400000, 400000000, 10, 800, 20, 2500, 0, 0, 16, 1200, 0, 0]),
    iface("lo0", "Thu Jan  1 00:00:00 2026", 1, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ""
].join("\n");

const loginCalls = [
    { kind: "http", method: "get", target: "/", reply: reply.http(200, csrfPage("sid:aaaa1111,1768471200")) },
    { kind: "http", method: "post", target: "/", reply: [null, { statusCode: 302, headers: { location: "/index.php" }, body: "" }, ""] },
    { kind: "http", method: "get", target: "/diag_pf_info.php", reply: reply.http(200, csrfPage("sid:bbbb2222,1768471201")) },
    { kind: "http", method: "post", target: "/diag_pf_info.php", reply: reply.http(200, PAGE) }
];

module.exports = {
    cases: [{
        name: "pfSense 2.6.0 with em1 as log interface",
        entryPoints: { validate: { calls: loginCalls }, get_status: { calls: loginCalls } }
    }]
};
