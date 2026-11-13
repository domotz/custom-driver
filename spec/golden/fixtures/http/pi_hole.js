// Simulated Pi-hole v5.x replies. Shape follows the Pi-hole web API documentation (api.php, v5): with
// "?getCacheInfo&summary&auth=<token>" the answer is one JSON object holding the "summary" fields (counters are
// strings formatted with thousands separators, e.g. "3,245"; ads_percentage_today is a string; status is
// "enabled"/"disabled"; gravity_last_updated = { file_exists, absolute (epoch), relative: { days, hours,
// minutes } } with string members, as in the documented example) and the "cacheinfo" object.
// Both cases use a Pi-hole whose gravity database does not exist yet, so gravity_last_updated is just
// { file_exists: false }. A healthy gravity_last_updated (with "relative") cannot be recorded: the driver then
// builds the "Days since last DB update" variable with valueType "days" (pi_hole.js line 48), which production
// metric.js rejects, and with string days/hours it would also concatenate instead of add.
const reply = require("../../replies");

const body = (status, blocked, pct, total, relative) => ({
    domains_being_blocked: "1,024,512",
    dns_queries_today: total,
    ads_blocked_today: blocked,
    ads_percentage_today: pct,
    unique_domains: "2,345",
    queries_forwarded: "8,001",
    queries_cached: "4,310",
    clients_ever_seen: "12",
    unique_clients: "10",
    dns_queries_all_types: total,
    reply_NODATA: "301",
    reply_NXDOMAIN: "120",
    reply_CNAME: "4,000",
    reply_IP: "9,000",
    privacy_level: "0",
    status,
    gravity_last_updated: relative,
    cacheinfo: { "cache-size": 10000, "cache-live-freed": 0, "cache-inserted": 12345 }
});

const call = (b) => [{ kind: "http", method: "get", target: "/admin/api.php?getCacheInfo&summary&auth=pass", reply: reply.http(200, b, { "content-type": "application/json" }) }];

const enabled = body("enabled", "3,245", "21.2", "15,321", { file_exists: false });
const disabled = body("disabled", "0", "0", "1,200", { file_exists: false });

module.exports = {
    cases: [
        { name: "blocking enabled", entryPoints: { validate: { calls: call(enabled) }, get_status: { calls: call(enabled) } } },
        { name: "blocking disabled", entryPoints: { validate: { calls: call(disabled) }, get_status: { calls: call(disabled) } } }
    ]
};
