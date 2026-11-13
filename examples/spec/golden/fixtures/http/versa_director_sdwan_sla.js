// Simulated Versa Director 22.1.4 replies. Shape follows the Versa Director northbound REST API and its live-command
// gateway GET /vnms/dashboard/appliance/<hub>/live?uuid=<uuid>&command=orgs/org/<org>/sd-wan/sla-monitor/...:
//   brief           -> { "sdwan:brief": { up-path-cnt, down-path-cnt, suspend-path-cnt, active-path-cnt } }
//   path            -> HTTP 204 on 22.1.4 (valid node, no content); the third case simulates a release that fills it
//   end-to-end      -> { collection: { "sdwan:end-to-end": [{ "site-name" }] } } (an index of monitored sites)
//   end-to-end/status/<site> -> { "sdwan:status": { "site-name" } } (an object, no metrics on 22.1.4)
// plus POST /auth/token ({ access_token, user: { organization } }) and GET /vnms/appliance/appliance.
// Cases: default (counts only, per-site walk disabled), per-site walk (maxSlaSites), and a release whose
// sla-monitor/path carries per-path metrics (fwd/rev-loss-ratio in %, delay and *-delay-var in ms).
const reply = require("../../replies");

const TOKEN = { access_token: "eyJhbGciOiJSUzI1NiJ9.simulated", token_type: "Bearer", expires_in: 3600, user: { organization: "Acme" } };
const HDR = { Authorization: "Bearer " + TOKEN.access_token };

const INVENTORY = {
    "versanms.ApplianceStatusResult": {
        totalCount: 3,
        appliance: [
            { name: "branch-milan", uuid: "11111111-aaaa-4bbb-8ccc-000000000001", type: "branch" },
            { name: "HUB-Frankfurt", uuid: "22222222-aaaa-4bbb-8ccc-000000000002", type: "hub" },
            { name: "branch-rome", uuid: "33333333-aaaa-4bbb-8ccc-000000000003", type: "branch" }
        ]
    }
};

const BRIEF = { "sdwan:brief": { "up-path-cnt": 112, "down-path-cnt": 2, "suspend-path-cnt": 1, "active-path-cnt": 114 } };
const INDEX = { collection: { "sdwan:end-to-end": [{ "site-name": "branch-milan" }, { "site-name": "branch-rome" }, { "site-name": "branch-turin" }] } };

const live = (suffix) => "/vnms/dashboard/appliance/HUB-Frankfurt/live?uuid=22222222-aaaa-4bbb-8ccc-000000000002&command=orgs/org/Acme/sd-wan/sla-monitor" + suffix;
const liveCall = (suffix, response, host) => Object.assign({ kind: "http", method: "get", headers: HDR, target: live(suffix), reply: response }, host || {});
const authCalls = (host) => [
    Object.assign({ kind: "http", method: "post", target: "/auth/token", body: /grant_type/, reply: reply.http(200, TOKEN) }, host || {}),
    Object.assign({ kind: "http", method: "get", target: /^\/vnms\/appliance\/appliance\?offset=0&limit=\d+$/, headers: HDR, reply: reply.http(200, INVENTORY) }, host || {})
];
const json = (body) => reply.http(200, body, { "content-type": "application/json" });
const noContent = reply.http(204, "");

const base = { clientId: "domotz-client", clientSecret: "s3cret" };

const PATHS = {
    collection: {
        "sdwan:path": [
            { "remote-site-name": "branch-milan", "local-access-cktname": "WAN1", "remote-access-cktname": "WAN1", delay: "24", "fwd-delay-var": "3", "rev-delay-var": "4", "fwd-loss-ratio": "0.1", "rev-loss-ratio": "0.0" },
            { "remote-site-name": "branch-rome", "local-access-cktname": "WAN1", "remote-access-cktname": "WAN2", delay: "88", "fwd-delay-var": "21", "rev-delay-var": "19", "fwd-loss-ratio": "4.5", "rev-loss-ratio": "6.25" },
            { "remote-site-name": "branch-rome", "local-access-cktname": "LTE", "remote-access-cktname": "WAN2", delay: "140", "fwd-delay-var": "35", "rev-delay-var": "30", "fwd-loss-ratio": "0.0", "rev-loss-ratio": "0.5" }
        ]
    }
};

module.exports = {
    cases: [{
        name: "counts only (site walk disabled)",
        parameters: base,
        entryPoints: {
            validate: { calls: authCalls() },
            get_status: {
                calls: [...authCalls(), liveCall("/brief", json(BRIEF)), liveCall("/path", noContent), liveCall("/end-to-end", json(INDEX))],
                // 22.1.4-GA exposes no per-path metrics and the walk is off by default, so the table is empty by design and the worst-latency/worst-loss variables have no value
                expect: { allowEmptyTable: true, nullValues: ["worst-latency", "worst-loss"] }
            }
        }
    }, {
        name: "site walk of two sites",
        parameters: Object.assign({}, base, { maxSlaSites: "2" }),
        entryPoints: {
            validate: { calls: authCalls() },
            get_status: {
                calls: [
                    ...authCalls(), liveCall("/brief", json(BRIEF)), liveCall("/path", noContent), liveCall("/end-to-end", json(INDEX)),
                    liveCall("/end-to-end/status/branch-milan", json({ "sdwan:status": { "site-name": "branch-milan" } })),
                    liveCall("/end-to-end/status/branch-rome", json({ "sdwan:status": { "site-name": "branch-rome" } }))
                ],
                // 22.1.4-GA answers the per-site node with { site-name } only, so metrics, worst latency and worst loss are null
                expect: { nullValues: ["worst-latency", "worst-loss"] }
            }
        }
    }, {
        name: "release with per-path metrics, by hostname",
        parameters: Object.assign({}, base, { directorHost: "director.example.com" }),
        entryPoints: {
            validate: { calls: authCalls({ host: "director.example.com" }) },
            get_status: {
                calls: [
                    ...authCalls({ host: "director.example.com" }),
                    liveCall("/brief", json(BRIEF), { host: "director.example.com" }),
                    liveCall("/path", json(PATHS), { host: "director.example.com" })
                ]
            }
        }
    }]
};
