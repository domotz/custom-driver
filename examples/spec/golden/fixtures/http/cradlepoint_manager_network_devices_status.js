// Simulated Cradlepoint NetCloud Manager (NCM API v2) replies. Shape follows the NCM v2 "net_devices" resource,
// GET /api/v2/net_devices/[?id__in=a,b]: { data: [{ id (string), mfg_model, mfg_product, connection_state
// ("online" | "offline" | "unknown"), name, ipv4_address, resource_uri, ... }], meta: { limit, offset, next,
// previous } }. The four X-CP / X-ECM API credentials travel as headers to www.cradlepointecm.com.
// Two cases: all devices (an AER2200 online, an E300 offline, one that reports no product) and a two-id filter.
const reply = require("../../replies");

const HOST = "www.cradlepointecm.com";
const creds = { X_CP_API_ID: "cp-id", X_CP_API_KEY: "cp-key", X_ECM_API_ID: "ecm-id", X_ECM_API_KEY: "ecm-key" };
const headers = { "X-CP-API-ID": "cp-id", "X-CP-API-KEY": "cp-key", "X-ECM-API-ID": "ecm-id", "X-ECM-API-KEY": "ecm-key" };

const dev = (id, model, product, state) => ({
    id, name: "Router " + id, mfg_model: model, mfg_product: product, connection_state: state, ipv4_address: "10.1.1." + (Number(id) % 250),
    resource_uri: "https://www.cradlepointecm.com/api/v2/net_devices/" + id + "/", account: "https://www.cradlepointecm.com/api/v2/accounts/9001/"
});
const body = (data) => ({ data, meta: { limit: 20, offset: 0, next: null, previous: null } });

const d1 = dev("34536881", "AER2200-600M", "AER2200", "online");
const d2 = dev("34536882", "E300-C18B", "E300", "offline");
const d3 = dev("34536883", "IBR900-600M", null, "unknown");

const call = (target, data) => [{ kind: "http", method: "get", host: HOST, protocol: "https", target, headers, reply: reply.http(200, body(data), { "content-type": "application/json" }) }];

module.exports = {
    cases: [
        {
            name: "all devices",
            parameters: Object.assign({ deviceIds: ["All"] }, creds),
            entryPoints: { validate: { calls: call("/api/v2/net_devices", [d1, d2, d3]) }, get_status: { calls: call("/api/v2/net_devices", [d1, d2, d3]) } }
        },
        {
            name: "filtered by two ids",
            parameters: Object.assign({ deviceIds: ["34536881", "34536882"] }, creds),
            entryPoints: {
                validate: { calls: call("/api/v2/net_devices/?id__in=34536881,34536882", [d1, d2]) },
                get_status: { calls: call("/api/v2/net_devices/?id__in=34536881,34536882", [d1, d2]) }
            }
        }
    ]
};
