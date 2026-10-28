// Simulated UniFi Network Application local API replies. Shape follows GET /proxy/network/api/s/default/stat/device:
// { meta: { rc: "ok" }, data: [ <device>, ... ] }, where a UPS Tower carries vbms_table.battpool. The device
// matching the agent's MAC (00:00:5E:00:53:01 in the golden fake device) is the second entry.
const reply = require("../../replies");

const UDM = "192.168.1.1";
const API_KEY = "unifi-api-key-123";

const data = [
    { mac: "f0:9f:c2:11:22:33", name: "UDM Pro", type: "udm", model: "UDMPRO" },
    {
        mac: "00:00:5e:00:53:01",
        name: "UPS Tower",
        type: "ubb",
        model: "UPSTWR",
        vbms_table: {
            is_battery_mode: false,
            battpool: {
                batteryLevel: 87,
                ischarging: true,
                device_output_voltage: 120.4,
                device_output_current: 2.35,
                device_total_power_output: 283,
                device_total_power_budget: 1500,
                device_total_power_factor: 0.98,
                readycnt: 3,
                batt_available_cnt: 4,
                timeToRemain: 5400
            }
        }
    }
];

module.exports = {
    cases: [{
        name: "ups tower on mains, charging",
        parameters: { udmIp: UDM, apiKey: API_KEY },
        entryPoints: {
            validate: { calls: [] }, // validate only checks the parameters
            get_status: {
                calls: [{
                    kind: "http", method: "get", host: UDM, target: "/proxy/network/api/s/default/stat/device",
                    headers: { "X-API-Key": API_KEY },
                    reply: reply.http(200, { meta: { rc: "ok" }, data })
                }]
            }
        }
    }]
};
