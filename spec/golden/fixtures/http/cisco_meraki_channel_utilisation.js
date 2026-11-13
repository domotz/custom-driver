// Simulated Meraki Dashboard API v1 replies. Shape follows getOrganizationNetworks (array of network objects) and
// getNetworkNetworkHealthChannelUtilization: an array of { serial, model, tags, wifi0: [{ start_ts, end_ts,
// utilization, wifi, non_wifi }], wifi1: [...] }, one entry per access point, one sample per interval. The
// wired network answers 400 ("only wireless networks"), as the driver expects.
const reply = require("../../replies");

const ORG_ID = "2930418";
const HOST = "api.meraki.com";
const AUTH = { Authorization: "Bearer 75dd5334bef4d2bc96f26138ae0a7b4a4ce5f7f1" };

const networks = [
    { id: "L_646829496481105433", organizationId: ORG_ID, name: "HQ Wireless", productTypes: ["wireless"], timeZone: "Europe/Rome", tags: [] },
    { id: "L_646829496481105434", organizationId: ORG_ID, name: "Branch Wireless", productTypes: ["wireless", "switch"], timeZone: "Europe/London", tags: [] },
    { id: "L_646829496481105435", organizationId: ORG_ID, name: "Wired DC", productTypes: ["switch"], timeZone: "Europe/Rome", tags: [] }
];

const sample = (utilization, wifi, nonWifi) => ({ start_ts: "2024-05-07T08:00:00.090Z", end_ts: "2024-05-07T08:05:00.090Z", utilization, wifi, non_wifi: nonWifi });

const hq = [
    { serial: "Q234-ABCD-5678", model: "MR46", tags: ["lobby"], wifi0: [sample(12.5, 9.1, 3.4)], wifi1: [sample(41.2, 30.0, 11.2)] },
    { serial: "Q234-ABCD-5679", model: "MR36", tags: ["floor2"], wifi0: [sample(4.0, 3.0, 1.0)], wifi1: [sample(85.7, 20.2, 65.5)] }
];
const branch = [
    { serial: "Q234-ABCD-5680", model: "MR33", tags: ["branch"], wifi0: [sample(7.7, 6.6, 1.1)] },
    // an untagged AP: tags is an empty array
    { serial: "Q234-ABCD-5681", model: "MR28", tags: [], wifi0: [sample(2.5, 2.0, 0.5)] }
];

const get = (target, status, body) => ({ kind: "http", method: "get", host: HOST, target, headers: AUTH, reply: reply.http(status, body) });
const chan = (id) => "/api/v1/networks/" + id + "/networkHealth/channelUtilization?timespan=900";

const calls = () => [
    get("/api/v1/organizations/" + ORG_ID + "/networks", 200, networks),
    get(chan("L_646829496481105433"), 200, hq),
    get(chan("L_646829496481105434"), 200, branch),
    get(chan("L_646829496481105435"), 400, { errors: ["Channel utilization is only available for wireless networks"] })
];

module.exports = {
    cases: [{
        name: "two wireless networks and one wired",
        parameters: { apiKey: "75dd5334bef4d2bc96f26138ae0a7b4a4ce5f7f1", organizationID: ORG_ID, networkID: "ALL" },
        entryPoints: {
            validate: { calls: calls() },
            get_status: { calls: calls() }
        }
    }]
};
