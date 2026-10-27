// Simulated Versa Director 22.1.4 replies. Shape follows the Versa Director northbound REST API: POST /auth/token
// (OAuth password grant) answers { access_token, token_type, expires_in, refresh_token }; GET
// /vnms/appliance/appliance answers { "versanms.ApplianceStatusResult": { appliance: [{ name, ... }] } } and GET
// /vnms/fault/alarms answers { List: { value: [{ deviceName, org, type, severity, lastStatusChangeTimeStamp
// (epoch ms), lastAlarmText, ... }] } }. One alarm names a controller that is not in the appliance inventory.
const reply = require("../../replies");

const TOKEN = { access_token: "eyJhbGciOiJSUzI1NiJ9.simulated", token_type: "Bearer", expires_in: 3600, refresh_token: "r-simulated" };

const INVENTORY = {
    "versanms.ApplianceStatusResult": {
        totalCount: 3,
        appliance: [
            { name: "branch-milan", type: "branch", ping_status: "REACHABLE", sync_status: "IN_SYNC" },
            { name: "branch-rome", type: "branch", ping_status: "REACHABLE", sync_status: "IN_SYNC" },
            { name: "hub-frankfurt", type: "hub", ping_status: "REACHABLE", sync_status: "IN_SYNC" }
        ]
    }
};

// 2026-01-15T09:30:00Z = 1768469400000
const alarm = (deviceName, type, severity, ts, text) => ({
    deviceName, org: "Acme", type, device: deviceName, "specific-problem": type, severity,
    lastPerceivedSeverity: severity, lastStatusChangeTimeStamp: ts, lastAlarmText: text, statusChanges: 1, alarmHandlings: 0
});

const ALARMS = {
    List: {
        value: [
            alarm("branch-milan", "interface-down", "critical", 1768469400000, "Interface vni-0/1 operationally down"),
            alarm("branch-milan", "sla-violation", "major", 1768465800000, "SLA violation on path to hub-frankfurt"),
            alarm("branch-milan", "cpu-high", "warning", 1768460000000, "CPU above 80%"),
            alarm("hub-frankfurt", "sla-violation", "indeterminate", 1768467000000, "SLA probe indeterminate"),
            alarm("controller-1", "cert-expiry", "minor", 1768400000000, "Certificate expires in 14 days")
        ]
    }
};

function calls(extra) {
    const host = extra || {};
    const hdr = { Authorization: "Bearer " + TOKEN.access_token };
    return [
        Object.assign({ kind: "http", method: "post", target: "/auth/token", body: /grant_type/, reply: reply.http(200, TOKEN) }, host),
        Object.assign({ kind: "http", method: "get", target: /^\/vnms\/appliance\/appliance\?offset=0&limit=1000$/, headers: hdr, reply: reply.http(200, INVENTORY) }, host),
        Object.assign({ kind: "http", method: "get", target: /^\/vnms\/fault\/alarms\?offset=0&limit=5000$/, headers: hdr, reply: reply.http(200, ALARMS) }, host)
    ];
}

function validateCalls(extra) {
    const host = extra || {};
    return [
        Object.assign({ kind: "http", method: "post", target: "/auth/token", body: /grant_type/, reply: reply.http(200, TOKEN) }, host),
        Object.assign({ kind: "http", method: "get", target: /^\/vnms\/fault\/alarms\?offset=0&limit=1$/, headers: { Authorization: "Bearer " + TOKEN.access_token }, reply: reply.http(200, ALARMS) }, host)
    ];
}

const base = { clientId: "domotz-client", clientSecret: "s3cret" };

module.exports = {
    cases: [{
        name: "director by device ip",
        parameters: base,
        entryPoints: { validate: { calls: validateCalls() }, get_status: { calls: calls() } }
    }, {
        name: "director by hostname with custom ports",
        parameters: Object.assign({}, base, { directorHost: "https://director.example.com:9183/auth/token", authPort: "9183", apiPort: "9182", maxAlarms: "5000" }),
        entryPoints: {
            validate: { calls: validateCalls({ host: "director.example.com" }) },
            get_status: { calls: calls({ host: "director.example.com" }) }
        }
    }]
};
