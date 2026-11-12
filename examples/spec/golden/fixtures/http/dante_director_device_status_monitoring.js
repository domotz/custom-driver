// Simulated Dante Director replies. Shape follows the Dante Managed API (GraphQL at api.director.dante.cloud):
// { data: { domain: { devices: [...] } } } with the fields the driver's query selects (identity, interfaces,
// status with clocking/latency/connectivity/subscriptions and alertMessage, rxChannels, txChannels).
const reply = require("../../replies");

const HOST = "api.director.dante.cloud";
const API_KEY = "ak_live_0123456789abcdef";

const devices = [
    {
        id: "dev-0001",
        name: "Stage-Box-A",
        identity: { manufacturerName: "Audinate", productModelName: "AVIO-AES3", danteVersion: "4.2.1" },
        interfaces: [{ address: "192.168.10.21" }, { address: "192.168.20.21" }],
        status: {
            id: "OK", clocking: "OK", latency: "OK", connectivity: "OK", subscriptions: "OK",
            alertMessage: { clocking: null, connectivity: null, latency: null, subscriptions: null }
        },
        rxChannels: [
            { id: "rx1", index: 1, name: "In 1", subscribedDevice: "Mixer-FOH", subscribedChannel: "Out 1", status: "SUBSCRIBED" },
            { id: "rx2", index: 2, name: "In 2", subscribedDevice: "Mixer-FOH", subscribedChannel: "Out 2", status: "SUBSCRIBED" }
        ],
        txChannels: [
            { id: "tx1", index: 1, name: "Out 1" },
            { id: "tx2", index: 2, name: "Out 2" }
        ]
    },
    {
        id: "dev-0002",
        name: "Mixer-FOH",
        identity: { manufacturerName: "Yamaha", productModelName: "CL5", danteVersion: "4.0.9" },
        interfaces: [{ address: "192.168.10.30" }],
        status: {
            id: "WARNING", clocking: "OK", latency: "WARNING", connectivity: "OK", subscriptions: "ERROR",
            alertMessage: {
                clocking: null, connectivity: null,
                latency: "Latency is below the recommended value",
                subscriptions: "1 subscription is unresolved"
            }
        },
        rxChannels: [
            { id: "rx3", index: 1, name: "Ch 1", subscribedDevice: "Stage-Box-A", subscribedChannel: "Out 1", status: "SUBSCRIBED" },
            { id: "rx4", index: 2, name: "Ch 2", subscribedDevice: "Stage-Box-B", subscribedChannel: "Out 9", status: "UNRESOLVED" }
        ],
        txChannels: [{ id: "tx3", index: 1, name: "Main L" }]
    }
];

const call = () => ({
    kind: "http", method: "post", host: HOST, target: "/graphql",
    headers: { Authorization: API_KEY, "Content-Type": "application/json" },
    body: /"variables":\{"domainId":"dom-42"\}/,
    reply: reply.http(200, { data: { domain: { devices } } })
});

module.exports = {
    cases: [{
        name: "domain with two devices, one degraded",
        parameters: { domainID: "dom-42", apiKey: API_KEY },
        entryPoints: {
            validate: { calls: [call()] },
            get_status: { calls: [call()] }
        }
    }]
};
