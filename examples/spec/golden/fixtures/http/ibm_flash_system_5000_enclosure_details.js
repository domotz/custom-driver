// Simulated FlashSystem 5000 (8.5.0.6) replies. Command: lsenclosure (-json), an array.
// Format notes: counts are strings; managed yes/no; expansion enclosure has IO_group_id/name 0/io_grp0
// and 0 SEMs, a degraded enclosure reports fewer online than total canisters/PSUs.
const reply = require("../../replies");

const TOKEN = "a1b2c3d4e5f60718293a4b5c6d7e8f90";

const authCall = { kind: "http", method: "post", target: "/rest/auth", headers: { "X-Auth-Username": "user", "X-Auth-Password": "pass" }, reply: reply.http(200, { token: TOKEN }) };
const dataCall = (command, body) => ({ kind: "http", method: "post", target: "/rest/" + command, headers: { "X-Auth-Token": TOKEN }, reply: reply.http(200, body) });

const lsenclosure = [
    {
        id: "1", status: "online", type: "control", managed: "yes", IO_group_id: "0", IO_group_name: "io_grp0",
        product_MTM: "2072-24C", serial_number: "78A1B2C", total_canisters: "2", online_canisters: "2",
        total_PSUs: "2", online_PSUs: "2", drive_slots: "24", total_fan_modules: "0", online_fan_modules: "0",
        total_sems: "0", online_sems: "0"
    },
    {
        id: "2", status: "degraded", type: "expansion", managed: "yes", IO_group_id: "0", IO_group_name: "io_grp0",
        product_MTM: "2072-24E", serial_number: "78A1B3D", total_canisters: "2", online_canisters: "1",
        total_PSUs: "2", online_PSUs: "1", drive_slots: "24", total_fan_modules: "0", online_fan_modules: "0",
        total_sems: "0", online_sems: "0"
    }
];

const calls = () => [authCall, dataCall("lsenclosure", lsenclosure)];

module.exports = {
    cases: [{
        name: "control plus degraded expansion",
        entryPoints: { validate: { calls: calls() }, get_status: { calls: calls() } }
    }]
};
