// Simulated Versa Director 22.1.4 replies. Shape follows the Versa Director northbound REST API: POST /auth/token
// ({ access_token, user: { organization } }), GET /vnms/appliance/appliance ({ "versanms.ApplianceStatusResult":
// { appliance: [{ name, uuid, ... }] } }) and the live-command gateway GET /vnms/dashboard/appliance/<name>/live?
// uuid=<uuid>&command=orgs/org/<org>/sd-wan/statistics/access-circuit, which answers { collection: {
// "sdwan:access-circuit": [{ "site-name", "ackt-detail": [{ local-ackt-name, remote-ackt-name, encap-type,
// local-ip, remote-ip, rx-pkts, rx-bytes, tx-pkts, tx-bytes }] }] } } with the counters as strings. A site often
// has a plaintext and an encrypted circuit between the same pair of circuit names.
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

const detail = (local, remote, encap, lip, rip, rxp, rxb, txp, txb) => ({
    "local-ackt-name": local, "remote-ackt-name": remote, "encap-type": encap, "local-ip": lip, "remote-ip": rip,
    "rx-pkts": rxp, "rx-bytes": rxb, "tx-pkts": txp, "tx-bytes": txb
});

const CIRCUITS = {
    collection: {
        "sdwan:access-circuit": [
            {
                "site-name": "branch-milan",
                "ackt-detail": [
                    detail("WAN1", "WAN1", "plaintext", "203.0.113.10", "198.51.100.21", "1200", "96000", "1100", "88000"),
                    detail("WAN1", "WAN1", "encrypted", "203.0.113.10", "198.51.100.21", "98765432", "74123456789", "87654321", "65432109876")
                ]
            },
            {
                "site-name": "branch-rome",
                "ackt-detail": [
                    detail("WAN2", "WAN1", "encrypted", "192.0.2.14", "198.51.100.21", "5500", "4400000", "0", "0")
                ]
            },
            { "site-name": "branch-turin", "ackt-detail": [] }
        ]
    }
};

function calls(extra) {
    const host = extra || {};
    return [
        Object.assign({ kind: "http", method: "post", target: "/auth/token", body: /grant_type/, reply: reply.http(200, TOKEN) }, host),
        Object.assign({ kind: "http", method: "get", target: /^\/vnms\/appliance\/appliance\?offset=0&limit=\d+$/, headers: HDR, reply: reply.http(200, INVENTORY) }, host),
        Object.assign({
            kind: "http", method: "get", headers: HDR,
            target: "/vnms/dashboard/appliance/HUB-Frankfurt/live?uuid=22222222-aaaa-4bbb-8ccc-000000000002&command=orgs/org/Acme/sd-wan/statistics/access-circuit",
            reply: reply.http(200, CIRCUITS)
        }, host)
    ];
}

const base = { clientId: "domotz-client", clientSecret: "s3cret" };

module.exports = {
    cases: [{
        name: "hub auto-selected by name",
        parameters: base,
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }, {
        name: "director by hostname",
        parameters: Object.assign({}, base, { directorHost: "director.example.com", sourceAppliance: "hub-frankfurt" }),
        entryPoints: {
            validate: { calls: calls({ host: "director.example.com" }) },
            get_status: { calls: calls({ host: "director.example.com" }) }
        }
    }]
};
