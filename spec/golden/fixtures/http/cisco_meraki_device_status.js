// Source: Meraki Dashboard API v1 reference examples (getOrganization,
// getOrganizationDevicesAvailabilities), extended to one device per status.
const reply = require("../../replies");

const ORG_ID = "2930418";
const HOST = "api.meraki.com";

const organization = {
    id: ORG_ID,
    name: "My organization",
    url: "https://dashboard.meraki.com/o/VjjsAd/manage/organization/overview",
    api: { enabled: true },
    licensing: { model: "co-term" },
    cloud: { region: { name: "North America", host: { name: "United States" } } },
    management: { details: [{ name: "MSP ID", value: "123456" }] }
};

const availabilities = [
    { mac: "00:11:22:33:44:55", name: "My AP", network: { id: "N_24329156" }, productType: "wireless", serial: "Q234-ABCD-5678", status: "online", tags: ["tag1", "tag2"] },
    { mac: "00:11:22:33:44:56", name: "Core Switch", network: { id: "N_24329156" }, productType: "switch", serial: "Q234-ABCD-5679", status: "alerting", tags: [] },
    { mac: "00:11:22:33:44:57", name: "", network: { id: "N_24329157" }, productType: "appliance", serial: "Q234-ABCD-5680", status: "offline", tags: ["branch"] },
    { mac: "00:11:22:33:44:58", name: "Spare camera", network: { id: "N_24329157" }, productType: "camera", serial: "Q234-ABCD-5681", status: "dormant", tags: [] }
];

module.exports = {
    cases: [{
        name: "organization with four devices",
        parameters: { apiKey: "75dd5334bef4d2bc96f26138ae0a7b4a4ce5f7f1", organizationID: ORG_ID },
        entryPoints: {
            validate: {
                calls: [
                    { kind: "http", method: "get", host: HOST, target: "/api/v1/organizations/" + ORG_ID, reply: reply.http(200, organization) }
                ]
            },
            get_status: {
                calls: [
                    { kind: "http", method: "get", host: HOST, target: "/api/v1/organizations/" + ORG_ID + "/devices/availabilities", reply: reply.http(200, availabilities) }
                ]
            }
        }
    }]
};
